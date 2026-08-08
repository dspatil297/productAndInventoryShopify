import type { Shop } from "@/generated/prisma/client";
import { setShopInventoryQuantities } from "@/lib/inventory/set-quantities";
import type { MetafieldUpdateInput } from "@/lib/metafields/types";
import {
  normalizeMetafieldValue,
  validateMetafieldValue,
} from "@/lib/metafields/validators";
import { publishShopProduct } from "@/lib/products/publish-product";
import { stageProductImage } from "@/lib/products/staged-upload";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import {
  PRODUCT_CREATE_MUTATION,
  PRODUCT_VARIANTS_BULK_UPDATE_MUTATION,
} from "@/lib/shopify/mutations";

export interface CreateProductInput {
  title: string;
  handle?: string;
  descriptionHtml?: string;
  productType?: string;
  vendor?: string;
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  /** Online Store theme template suffix (null/omit = default product.json). */
  templateSuffix?: string | null;
  price?: string;
  compareAtPrice?: string;
  sku?: string;
  inventoryPolicy?: "DENY" | "CONTINUE";
  trackInventory?: boolean;
  inventoryQuantity?: number | null;
  locationId?: string | null;
  /** Publish to sales channels when status is ACTIVE (default true). */
  publish?: boolean;
  metafields?: Array<Omit<MetafieldUpdateInput, "ownerId">>;
  images?: File[];
  /** Already-staged Shopify resource URLs (skips upload). */
  imageResourceUrls?: string[];
}

export interface CreateProductResult {
  productId: string | null;
  title: string | null;
  handle: string | null;
  errors: string[];
}

interface ProductCreateResponse {
  productCreate: {
    product: {
      id: string;
      title: string;
      handle: string;
      status: string;
      variants: {
        nodes: Array<{
          id: string;
          sku: string | null;
          price: string;
          inventoryItem: { id: string; tracked: boolean } | null;
        }>;
      };
    } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

interface ProductVariantsBulkUpdateResponse {
  productVariantsBulkUpdate: {
    productVariants: Array<{ id: string }> | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

async function stageImages(
  shop: Shop,
  images: File[],
): Promise<{ urls: string[]; error: string | null }> {
  const urls: string[] = [];
  for (const image of images) {
    try {
      urls.push(await stageProductImage(shop, image));
    } catch (error) {
      return {
        urls,
        error: error instanceof Error ? error.message : "Image upload failed",
      };
    }
  }
  return { urls, error: null };
}

export async function createShopProduct(
  shop: Shop,
  input: CreateProductInput,
): Promise<CreateProductResult> {
  const errors: string[] = [];
  const title = input.title.trim();
  if (!title) {
    return { productId: null, title: null, handle: null, errors: ["Title is required"] };
  }

  const metafields: Array<{
    namespace: string;
    key: string;
    type: string;
    value: string;
  }> = [];

  for (const metafield of input.metafields ?? []) {
    const value = normalizeMetafieldValue(metafield.type, metafield.value);
    if (!value) {
      continue;
    }
    const validation = validateMetafieldValue(metafield.type, value);
    if (!validation.ok) {
      return {
        productId: null,
        title: null,
        handle: null,
        errors: [
          `${metafield.namespace}.${metafield.key} (type: ${metafield.type}): ${validation.message}`,
        ],
      };
    }
    metafields.push({
      namespace: metafield.namespace,
      key: metafield.key,
      type: metafield.type,
      value,
    });
  }

  // Soft-fail images: product still creates if staging/upload breaks
  const stagedUrls = [...(input.imageResourceUrls ?? [])];
  if ((input.images?.length ?? 0) > 0) {
    const staged = await stageImages(shop, input.images ?? []);
    if (staged.error) {
      errors.push(staged.error);
    }
    stagedUrls.push(...staged.urls);
  }

  const status = input.status ?? "ACTIVE";
  const product: Record<string, unknown> = {
    title,
    status,
  };

  if (input.handle?.trim()) {
    product.handle = input.handle.trim();
  }
  if (input.descriptionHtml?.trim()) {
    product.descriptionHtml = input.descriptionHtml.trim();
  }
  if (input.productType?.trim()) {
    product.productType = input.productType.trim();
  }
  if (input.vendor?.trim()) {
    product.vendor = input.vendor.trim();
  }
  if (input.templateSuffix !== undefined) {
    product.templateSuffix = input.templateSuffix?.trim() || null;
  }
  if (metafields.length > 0) {
    product.metafields = metafields;
  }

  const media =
    stagedUrls.length > 0
      ? stagedUrls.map((originalSource, index) => ({
          originalSource,
          mediaContentType: "IMAGE",
          alt: index === 0 ? title : `${title} ${index + 1}`,
        }))
      : undefined;

  const data = await shopifyGraphqlForShop<ProductCreateResponse>(
    shop,
    PRODUCT_CREATE_MUTATION,
    { product, media },
  );

  for (const userError of data.productCreate.userErrors) {
    const fieldPath = userError.field?.join(".") ?? "";
    const metafieldMatch = /^metafields\.(\d+)/.exec(fieldPath);
    if (metafieldMatch) {
      const index = Number.parseInt(metafieldMatch[1], 10);
      const mf = metafields[index];
      if (mf) {
        errors.push(
          `${mf.namespace}.${mf.key} (type: ${mf.type}): ${userError.message}`,
        );
        continue;
      }
    }
    errors.push(
      fieldPath ? `${userError.message} (${fieldPath})` : userError.message,
    );
  }

  const created = data.productCreate.product;
  if (!created) {
    return {
      productId: null,
      title: null,
      handle: null,
      errors: errors.length > 0 ? errors : ["Product create failed"],
    };
  }

  const price = input.price?.trim() ?? "";
  const compareAtPrice = input.compareAtPrice?.trim() ?? "";
  const sku = input.sku?.trim() ?? "";
  const trackInventory = Boolean(input.trackInventory);
  const inventoryPolicy = input.inventoryPolicy;
  const defaultVariant = created.variants.nodes[0];

  const needsVariantUpdate =
    Boolean(defaultVariant) &&
    (price ||
      compareAtPrice ||
      sku ||
      trackInventory ||
      inventoryPolicy === "DENY" ||
      inventoryPolicy === "CONTINUE");

  if (defaultVariant && needsVariantUpdate) {
    const variantInput: Record<string, unknown> = { id: defaultVariant.id };
    if (price) {
      variantInput.price = price;
    }
    if (compareAtPrice) {
      variantInput.compareAtPrice = compareAtPrice;
    }
    if (inventoryPolicy === "DENY" || inventoryPolicy === "CONTINUE") {
      variantInput.inventoryPolicy = inventoryPolicy;
    }

    const inventoryItem: Record<string, unknown> = {};
    if (sku) {
      inventoryItem.sku = sku;
    }
    if (trackInventory) {
      inventoryItem.tracked = true;
    }
    if (Object.keys(inventoryItem).length > 0) {
      variantInput.inventoryItem = inventoryItem;
    }

    const variantData =
      await shopifyGraphqlForShop<ProductVariantsBulkUpdateResponse>(
        shop,
        PRODUCT_VARIANTS_BULK_UPDATE_MUTATION,
        {
          productId: created.id,
          variants: [variantInput],
        },
      );

    for (const userError of variantData.productVariantsBulkUpdate.userErrors) {
      errors.push(userError.message);
    }
  }

  const inventoryItemId = defaultVariant?.inventoryItem?.id;
  const quantity =
    typeof input.inventoryQuantity === "number" &&
    Number.isFinite(input.inventoryQuantity)
      ? Math.trunc(input.inventoryQuantity)
      : null;
  const locationId = input.locationId?.trim() || null;

  if (trackInventory && inventoryItemId && locationId && quantity !== null) {
    const inventoryResult = await setShopInventoryQuantities(shop, [
      {
        inventoryItemId,
        locationId,
        quantity,
        changeFromQuantity: null,
      },
    ]);
    for (const inventoryError of inventoryResult.errors) {
      errors.push(inventoryError.message);
    }
  }

  const shouldPublish = Boolean(input.publish) && status === "ACTIVE";
  if (shouldPublish) {
    try {
      const publishResult = await publishShopProduct(shop, created.id);
      for (const publishError of publishResult.errors) {
        errors.push(publishError);
      }
    } catch (error) {
      errors.push(
        error instanceof Error
          ? `Publish failed: ${error.message}`
          : "Publish failed",
      );
    }
  }

  return {
    productId: created.id,
    title: created.title,
    handle: created.handle,
    errors,
  };
}
