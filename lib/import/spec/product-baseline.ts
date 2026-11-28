import type { Shop } from "@/generated/prisma/client";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import { PRODUCT_BY_HANDLE_QUERY } from "@/lib/shopify/queries";

const METAFIELD_FIRST = 50;

export interface ProductBaseline {
  id: string;
  variantId: string | null;
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

const PRODUCTS_BATCH_BY_HANDLES_QUERY = `
  query ProductsBatchByHandles($first: Int!, $query: String!, $metafieldFirst: Int!) {
    products(first: $first, query: $query) {
      nodes {
        id
        title
        handle
        descriptionHtml
        templateSuffix
        variants(first: 1) {
          nodes {
            id
            sku
            price
            compareAtPrice
          }
        }
        metafields(first: $metafieldFirst) {
          nodes {
            namespace
            key
            type
            value
            jsonValue
          }
        }
      }
    }
  }
`;

interface ProductsBatchResponse {
  products: {
    nodes: Array<NonNullable<ProductByHandleResponse["productByIdentifier"]>>;
  };
}

function mapProductNodeToBaseline(
  product: NonNullable<ProductByHandleResponse["productByIdentifier"]>,
): ProductBaseline {
  const variant = product.variants.nodes[0];
  const metafields: Record<string, string> = {};
  for (const node of product.metafields.nodes) {
    metafields[`${node.namespace}.${node.key}`] = formatMetafieldValue(node);
  }

  return {
    id: product.id,
    variantId: variant?.id ?? null,
    handle: product.handle,
    title: product.title,
    body_html: product.descriptionHtml ?? "",
    template_suffix: product.templateSuffix?.trim() ?? "",
    price: variant?.price ?? "",
    compare_at_price: variant?.compareAtPrice ?? "",
    sku: variant?.sku ?? "",
    metafields,
  };
}

export async function fetchProductBaselinesBatch(
  shop: Shop,
  handles: string[],
): Promise<Map<string, ProductBaseline | null>> {
  const unique = [...new Set(handles.map((h) => h.trim()).filter(Boolean))];
  const result = new Map<string, ProductBaseline | null>();
  for (const h of unique) {
    result.set(h, null);
  }
  if (unique.length === 0) {
    return result;
  }

  for (let i = 0; i < unique.length; i += 25) {
    const chunk = unique.slice(i, i + 25);
    const query = chunk
      .map((h) => `handle:'${h.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`)
      .join(" OR ");
    try {
      const data = await shopifyGraphqlForShop<ProductsBatchResponse>(
        shop,
        PRODUCTS_BATCH_BY_HANDLES_QUERY,
        {
          first: chunk.length,
          query,
          metafieldFirst: METAFIELD_FIRST,
        },
      );
      for (const node of data.products.nodes) {
        result.set(node.handle, mapProductNodeToBaseline(node));
      }
    } catch (err) {
      console.warn(
        "[baseline] Batch lookup failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // Fallback via productByIdentifier for handles missed by products(query:) search index
  const missing = unique.filter((h) => !result.get(h));
  for (let i = 0; i < missing.length; i += 15) {
    const chunk = missing.slice(i, i + 15);
    const fields = chunk
      .map(
        (h, idx) =>
          `p${idx}: productByIdentifier(identifier: { handle: ${JSON.stringify(h)} }) {
            id title handle descriptionHtml templateSuffix
            variants(first: 1) { nodes { id sku price compareAtPrice } }
            metafields(first: ${METAFIELD_FIRST}) { nodes { namespace key type value jsonValue } }
          }`,
      )
      .join("\n");
    try {
      const data = await shopifyGraphqlForShop<
        Record<string, NonNullable<ProductByHandleResponse["productByIdentifier"]> | null>
      >(shop, `query ExactHandles {\n${fields}\n}`);
      chunk.forEach((h, idx) => {
        const node = data[`p${idx}`];
        if (node && node.handle === h) {
          result.set(h, mapProductNodeToBaseline(node));
        }
      });
    } catch (err) {
      console.warn(
        "[baseline] Exact handle lookup failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return result;
}

export async function findTakenHandles(
  shop: Shop,
  handles: string[],
): Promise<Set<string>> {
  const unique = [...new Set(handles.map((h) => h.trim()).filter(Boolean))];
  const taken = new Set<string>();
  for (let i = 0; i < unique.length; i += 20) {
    const chunk = unique.slice(i, i + 20);
    const fields = chunk
      .map(
        (h, idx) =>
          `h${idx}: productByIdentifier(identifier: { handle: ${JSON.stringify(h)} }) { id handle }`,
      )
      .join("\n");
    try {
      const data = await shopifyGraphqlForShop<
        Record<string, { id: string; handle: string } | null>
      >(shop, `query CheckHandles {\n${fields}\n}`);
      chunk.forEach((h, idx) => {
        if (data[`h${idx}`]) {
          taken.add(h);
        }
      });
    } catch {
      // ignore check failure; import worker still retries on collision
    }
  }
  return taken;
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
        setTimeout(() => reject(new Error("Baseline lookup timeout")), 5_000),
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
      variantId: variant?.id ?? null,
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
