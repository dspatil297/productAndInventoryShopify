import type { Shop } from "@/generated/prisma/client";
import { setShopMetafields } from "@/lib/metafields/set-metafields";
import type { MetafieldUpdateInput } from "@/lib/metafields/types";
import {
  normalizeMetafieldValue,
  validateMetafieldValue,
} from "@/lib/metafields/validators";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import {
  PRODUCT_UPDATE_MUTATION,
  PRODUCT_VARIANTS_BULK_UPDATE_MUTATION,
} from "@/lib/shopify/mutations";

export interface UpdateProductInput {
  productId: string;
  title: string;
  handle?: string;
  descriptionHtml?: string;
  productType?: string;
  vendor?: string;
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  templateSuffix?: string | null;
  variantId?: string | null;
  price?: string;
  compareAtPrice?: string;
  sku?: string;
  inventoryPolicy?: "DENY" | "CONTINUE";
  metafields?: Array<Omit<MetafieldUpdateInput, "ownerId">>;
}

export interface UpdateProductResult {
  productId: string | null;
  title: string | null;
  handle: string | null;
  previewUrl: string | null;
  errors: string[];
}

interface ProductUpdateResponse {
  productUpdate: {
    product: {
      id: string;
      title: string;
      handle: string;
      status: string;
      onlineStoreUrl: string | null;
      onlineStorePreviewUrl: string | null;
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

export async function updateShopProduct(
  shop: Shop,
  input: UpdateProductInput,
): Promise<UpdateProductResult> {
  const errors: string[] = [];
  const title = input.title.trim();
  if (!title) {
    return {
      productId: null,
      title: null,
      handle: null,
      previewUrl: null,
      errors: ["Title is required"],
    };
  }

  const product: Record<string, unknown> = {
    id: input.productId,
    title,
    ...(input.status ? { status: input.status } : {}),
  };

  if (input.handle?.trim()) {
    product.handle = input.handle.trim();
  }
  if (input.descriptionHtml !== undefined) {
    product.descriptionHtml = input.descriptionHtml;
  }
  if (input.productType !== undefined) {
    product.productType = input.productType.trim();
  }
  if (input.vendor !== undefined) {
    product.vendor = input.vendor.trim();
  }
  if (input.templateSuffix !== undefined) {
    product.templateSuffix = input.templateSuffix?.trim() || null;
  }

  const data = await shopifyGraphqlForShop<ProductUpdateResponse>(
    shop,
    PRODUCT_UPDATE_MUTATION,
    { product },
  );

  for (const userError of data.productUpdate.userErrors) {
    const fieldPath = userError.field?.join(".") ?? "";
    errors.push(fieldPath ? `${userError.message} (${fieldPath})` : userError.message);
  }

  const updated = data.productUpdate.product;
  if (!updated) {
    return {
      productId: null,
      title: null,
      handle: null,
      previewUrl: null,
      errors: errors.length > 0 ? errors : ["Product update failed"],
    };
  }

  const variantId = input.variantId?.trim() || null;
  const price = input.price?.trim() ?? "";
  const compareAtPrice = input.compareAtPrice?.trim() ?? "";
  const sku = input.sku?.trim() ?? "";
  const inventoryPolicy = input.inventoryPolicy;

  const hasVariantChanges = Boolean(
    price ||
      compareAtPrice ||
      input.compareAtPrice !== undefined ||
      sku ||
      input.sku !== undefined ||
      inventoryPolicy === "DENY" ||
      inventoryPolicy === "CONTINUE",
  );

  if (variantId && hasVariantChanges) {
    const variantInput: Record<string, unknown> = { id: variantId };
    if (price) {
      variantInput.price = price;
    }
    if (compareAtPrice) {
      variantInput.compareAtPrice = compareAtPrice;
    } else if (input.compareAtPrice !== undefined) {
      variantInput.compareAtPrice = null;
    }
    if (sku || input.sku !== undefined) {
      variantInput.inventoryItem = { sku };
    }
    if (inventoryPolicy === "DENY" || inventoryPolicy === "CONTINUE") {
      variantInput.inventoryPolicy = inventoryPolicy;
    }

    const variantData =
      await shopifyGraphqlForShop<ProductVariantsBulkUpdateResponse>(
        shop,
        PRODUCT_VARIANTS_BULK_UPDATE_MUTATION,
        {
          productId: updated.id,
          variants: [variantInput],
        },
      );

    for (const userError of variantData.productVariantsBulkUpdate.userErrors) {
      errors.push(userError.message);
    }
  }

  const metafieldUpdates: MetafieldUpdateInput[] = [];
  for (const metafield of input.metafields ?? []) {
    const value = normalizeMetafieldValue(metafield.type, metafield.value);
    if (!value) {
      continue;
    }
    const validation = validateMetafieldValue(metafield.type, value);
    if (!validation.ok) {
      errors.push(
        `${metafield.namespace}.${metafield.key} (type: ${metafield.type}): ${validation.message}`,
      );
      continue;
    }
    metafieldUpdates.push({
      ownerId: updated.id,
      namespace: metafield.namespace,
      key: metafield.key,
      type: metafield.type,
      value,
    });
  }

  if (metafieldUpdates.length > 0) {
    const metafieldResult = await setShopMetafields(shop, metafieldUpdates);
    for (const metafieldError of metafieldResult.errors) {
      errors.push(
        `${metafieldError.namespace}.${metafieldError.key}: ${metafieldError.message}`,
      );
    }
  }

  const previewUrl =
    updated.onlineStorePreviewUrl || updated.onlineStoreUrl || null;

  return {
    productId: updated.id,
    title: updated.title,
    handle: updated.handle,
    previewUrl,
    errors,
  };
}
