import type { ShopWithConfig } from "@/lib/shops/api-access";
import { readMetafieldDefinitionsFromConfig } from "@/lib/metafields/config";
import {
  metafieldColumnKey,
  type MetafieldGridRow,
  type MetafieldsListResponse,
  type ProductMetafieldValue,
} from "@/lib/metafields/types";
import { DEFAULT_PAGE_SIZE } from "@/lib/products/constants";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import { PRODUCTS_METAFIELDS_QUERY } from "@/lib/shopify/queries";
import type { MetafieldDefinitionNode } from "@/types/shopify";

interface ProductsMetafieldsGraphqlResponse {
  products: {
    edges: Array<{
      cursor: string;
      node: {
        id: string;
        title: string;
        handle: string;
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
      };
    }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
}

export interface ListShopMetafieldsInput {
  first?: number;
  after?: string | null;
  search?: string | null;
}

function escapeShopifyQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function buildProductsSearchQuery(search: string | null | undefined): string | undefined {
  const term = search?.trim();
  if (!term) {
    return undefined;
  }

  const escaped = escapeShopifyQueryValue(term);
  return `title:*${escaped}* OR handle:*${escaped}*`;
}

function formatMetafieldValue(
  node: ProductsMetafieldsGraphqlResponse["products"]["edges"][number]["node"]["metafields"]["nodes"][number],
): string {
  if (node.type === "json" && node.jsonValue !== null && node.jsonValue !== undefined) {
    return JSON.stringify(node.jsonValue);
  }

  return node.value ?? "";
}

function emptyValuesForDefinitions(
  definitions: MetafieldDefinitionNode[],
): Record<string, ProductMetafieldValue> {
  const values: Record<string, ProductMetafieldValue> = {};

  for (const definition of definitions) {
    const columnKey = metafieldColumnKey(definition.namespace, definition.key);
    values[columnKey] = {
      id: null,
      namespace: definition.namespace,
      key: definition.key,
      value: "",
      type: definition.type.name,
    };
  }

  return values;
}

function toMetafieldGridRow(
  node: ProductsMetafieldsGraphqlResponse["products"]["edges"][number]["node"],
  definitions: MetafieldDefinitionNode[],
): MetafieldGridRow {
  const values = emptyValuesForDefinitions(definitions);

  for (const metafield of node.metafields.nodes) {
    const columnKey = metafieldColumnKey(metafield.namespace, metafield.key);
    if (!(columnKey in values)) {
      continue;
    }

    values[columnKey] = {
      id: metafield.id,
      namespace: metafield.namespace,
      key: metafield.key,
      value: formatMetafieldValue(metafield),
      type: metafield.type,
    };
  }

  return {
    productId: node.id,
    title: node.title,
    handle: node.handle,
    values,
  };
}

export async function listShopMetafields(
  shop: ShopWithConfig,
  input: ListShopMetafieldsInput = {},
): Promise<MetafieldsListResponse> {
  const definitions = readMetafieldDefinitionsFromConfig(shop.config);
  const first = Math.min(Math.max(input.first ?? DEFAULT_PAGE_SIZE, 1), 50);
  const metafieldFirst = Math.min(Math.max(definitions.length, 1), 250);
  const query = buildProductsSearchQuery(input.search);

  const data = await shopifyGraphqlForShop<ProductsMetafieldsGraphqlResponse>(
    shop,
    PRODUCTS_METAFIELDS_QUERY,
    {
      first,
      after: input.after ?? null,
      query: query ?? null,
      metafieldFirst,
    },
  );

  return {
    definitions,
    rows: data.products.edges.map((edge) =>
      toMetafieldGridRow(edge.node, definitions),
    ),
    pageInfo: {
      hasNextPage: data.products.pageInfo.hasNextPage,
      endCursor:
        data.products.pageInfo.endCursor ??
        data.products.edges.at(-1)?.cursor ??
        null,
    },
  };
}
