import type { Shop } from "@/generated/prisma/client";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import { PRODUCT_BY_HANDLE_QUERY } from "@/lib/shopify/queries";

const METAFIELD_FIRST = 50;

export interface ProductBaseline {
  id: string;
  handle: string;
  title: string;
  body_html: string;
  template_suffix: string;
  price: string;
  compare_at_price: string;
  sku: string;
  metafields: Record<string, string>;
}

interface ProductByHandleResponse {
  productByIdentifier: {
    id: string;
    title: string;
    handle: string;
    descriptionHtml: string | null;
    templateSuffix: string | null;
    variants: {
      nodes: Array<{
        id: string;
        sku: string | null;
        price: string;
        compareAtPrice: string | null;
      }>;
    };
    metafields: {
      nodes: Array<{
        namespace: string;
        key: string;
        type: string;
        value: string;
        jsonValue: unknown;
      }>;
    };
  } | null;
}

function formatMetafieldValue(
  node: ProductByHandleResponse["productByIdentifier"] extends null
    ? never
    : NonNullable<ProductByHandleResponse["productByIdentifier"]>["metafields"]["nodes"][number],
): string {
  if (node.type === "json" && node.jsonValue !== null && node.jsonValue !== undefined) {
    return JSON.stringify(node.jsonValue);
  }
  return node.value ?? "";
}

export async function fetchProductBaselineByHandle(
  shop: Shop,
  handle: string,
): Promise<ProductBaseline | null> {
  try {
    const data = await Promise.race([
      shopifyGraphqlForShop<ProductByHandleResponse>(
        shop,
        PRODUCT_BY_HANDLE_QUERY,
        { handle, metafieldFirst: METAFIELD_FIRST },
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Baseline lookup timeout")), 2500),
      ),
    ]);

    const product = data.productByIdentifier;
    if (!product) {
      return null;
    }

    const variant = product.variants.nodes[0];
    const metafields: Record<string, string> = {};
    for (const node of product.metafields.nodes) {
      metafields[`${node.namespace}.${node.key}`] = formatMetafieldValue(node);
    }

    return {
      id: product.id,
      handle: product.handle,
      title: product.title,
      body_html: product.descriptionHtml ?? "",
      template_suffix: product.templateSuffix?.trim() ?? "",
      price: variant?.price ?? "",
      compare_at_price: variant?.compareAtPrice ?? "",
      sku: variant?.sku ?? "",
      metafields,
    };
  } catch (err) {
    console.warn(
      `[baseline] Shopify baseline lookup skipped for handle "${handle}":`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
