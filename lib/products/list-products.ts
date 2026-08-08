import type { Shop } from "@/generated/prisma/client";
import type {
  ProductListItem,
  ProductsListResponse,
} from "@/lib/products/types";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import { PRODUCTS_LIST_QUERY } from "@/lib/shopify/queries";

import { DEFAULT_PAGE_SIZE } from "@/lib/products/constants";

interface ProductsGraphqlResponse {
  products: {
    edges: Array<{
      cursor: string;
      node: {
        id: string;
        title: string;
        handle: string;
        productType: string;
        status: string;
        variants: {
          nodes: Array<{
            id: string;
            sku: string | null;
            price: string;
          }>;
        };
      };
    }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
}

export interface ListShopProductsInput {
  first?: number;
  after?: string | null;
  search?: string | null;
  productType?: string | null;
}

function escapeShopifyQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function buildProductsSearchQuery(input: ListShopProductsInput): string | undefined {
  const parts: string[] = [];

  if (input.productType) {
    parts.push(`product_type:'${escapeShopifyQueryValue(input.productType)}'`);
  }

  const search = input.search?.trim();
  if (search) {
    const term = escapeShopifyQueryValue(search);
    parts.push(`title:*${term}* OR handle:*${term}* OR sku:*${term}*`);
  }

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join(" AND ");
}

function formatPriceRange(variants: ProductListItem["variants"]): string {
  if (variants.length === 0) {
    return "—";
  }

  const prices = variants
    .map((variant) => Number.parseFloat(variant.price))
    .filter((price) => Number.isFinite(price));

  if (prices.length === 0) {
    return variants[0]?.price ?? "—";
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) {
    return min.toFixed(2);
  }

  return `${min.toFixed(2)} – ${max.toFixed(2)}`;
}

function toProductListItem(
  node: ProductsGraphqlResponse["products"]["edges"][number]["node"],
): ProductListItem {
  const variants = node.variants.nodes.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    price: variant.price,
  }));
  const skus = variants
    .map((variant) => variant.sku)
    .filter((sku): sku is string => Boolean(sku))
    .join(", ");

  return {
    id: node.id,
    title: node.title,
    handle: node.handle,
    productType: node.productType || "—",
    status: node.status,
    variants,
    skus: skus || "—",
    priceRange: formatPriceRange(variants),
  };
}

export async function listShopProducts(
  shop: Shop,
  input: ListShopProductsInput = {},
): Promise<ProductsListResponse> {
  const first = Math.min(Math.max(input.first ?? DEFAULT_PAGE_SIZE, 1), 50);
  const query = buildProductsSearchQuery(input);

  const data = await shopifyGraphqlForShop<ProductsGraphqlResponse>(
    shop,
    PRODUCTS_LIST_QUERY,
    {
      first,
      after: input.after ?? null,
      query: query ?? null,
    },
  );

  return {
    products: data.products.edges.map((edge) => toProductListItem(edge.node)),
    pageInfo: {
      hasNextPage: data.products.pageInfo.hasNextPage,
      endCursor:
        data.products.pageInfo.endCursor ??
        data.products.edges.at(-1)?.cursor ??
        null,
    },
  };
}
