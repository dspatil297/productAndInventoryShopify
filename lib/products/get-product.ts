import type { Shop } from "@/generated/prisma/client";
import { metafieldColumnKey } from "@/lib/metafields/types";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import { PRODUCT_EDIT_QUERY } from "@/lib/shopify/queries";

const METAFIELD_FIRST = 100;

export interface ProductEditVariant {
  id: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  inventoryPolicy: "DENY" | "CONTINUE";
}

export interface ProductEditData {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  productType: string;
  vendor: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  templateSuffix: string | null;
  onlineStoreUrl: string | null;
  onlineStorePreviewUrl: string | null;
  previewUrl: string | null;
  variant: ProductEditVariant | null;
  metafieldValues: Record<string, string>;
}

interface ProductEditGraphqlResponse {
  product: {
    id: string;
    title: string;
    handle: string;
    descriptionHtml: string | null;
    productType: string | null;
    vendor: string | null;
    status: string;
    templateSuffix: string | null;
    onlineStoreUrl: string | null;
    onlineStorePreviewUrl: string | null;
    variants: {
      nodes: Array<{
        id: string;
        sku: string | null;
        price: string;
        compareAtPrice: string | null;
        inventoryPolicy: string;
      }>;
    };
    metafields: {
      nodes: Array<{
        id: string;
        namespace: string;
        key: string;
        value: string;
        type: string;
        jsonValue: unknown;
      }>;
    };
  } | null;
}

function formatMetafieldValue(
  node: ProductEditGraphqlResponse["product"] extends null
    ? never
    : NonNullable<ProductEditGraphqlResponse["product"]>["metafields"]["nodes"][number],
): string {
  if (node.type === "json" && node.jsonValue !== null && node.jsonValue !== undefined) {
    return JSON.stringify(node.jsonValue);
  }
  return node.value ?? "";
}

function buildFallbackPreviewUrl(
  shopDomain: string,
  handle: string,
): string | null {
  const trimmed = handle.trim();
  if (!trimmed) {
    return null;
  }
  return `https://${shopDomain}/products/${encodeURIComponent(trimmed)}`;
}

export function resolveProductPreviewUrl(input: {
  onlineStorePreviewUrl: string | null;
  onlineStoreUrl: string | null;
  shopDomain: string;
  handle: string;
}): string | null {
  return (
    input.onlineStorePreviewUrl ||
    input.onlineStoreUrl ||
    buildFallbackPreviewUrl(input.shopDomain, input.handle)
  );
}

export async function getShopProductForEdit(
  shop: Shop,
  productId: string,
): Promise<ProductEditData | null> {
  const data = await shopifyGraphqlForShop<ProductEditGraphqlResponse>(
    shop,
    PRODUCT_EDIT_QUERY,
    { id: productId, metafieldFirst: METAFIELD_FIRST },
  );

  const product = data.product;
  if (!product) {
    return null;
  }

  const statusRaw = product.status.toUpperCase();
  const status =
    statusRaw === "DRAFT" || statusRaw === "ARCHIVED" ? statusRaw : "ACTIVE";

  const metafieldValues: Record<string, string> = {};
  for (const node of product.metafields.nodes) {
    const columnKey = metafieldColumnKey(node.namespace, node.key);
    metafieldValues[columnKey] = formatMetafieldValue(node);
  }

  const variantNode = product.variants.nodes[0] ?? null;
  const variant: ProductEditVariant | null = variantNode
    ? {
        id: variantNode.id,
        sku: variantNode.sku ?? "",
        price: variantNode.price ?? "",
        compareAtPrice: variantNode.compareAtPrice ?? "",
        inventoryPolicy:
          variantNode.inventoryPolicy === "CONTINUE" ? "CONTINUE" : "DENY",
      }
    : null;

  const previewUrl = resolveProductPreviewUrl({
    onlineStorePreviewUrl: product.onlineStorePreviewUrl,
    onlineStoreUrl: product.onlineStoreUrl,
    shopDomain: shop.shopDomain,
    handle: product.handle,
  });

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    descriptionHtml: product.descriptionHtml ?? "",
    productType: product.productType ?? "",
    vendor: product.vendor ?? "",
    status,
    templateSuffix: product.templateSuffix?.trim() || null,
    onlineStoreUrl: product.onlineStoreUrl,
    onlineStorePreviewUrl: product.onlineStorePreviewUrl,
    previewUrl,
    variant,
    metafieldValues,
  };
}
