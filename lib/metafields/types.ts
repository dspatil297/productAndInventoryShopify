import type { MetafieldDefinitionNode } from "@/types/shopify";

export interface ProductMetafieldValue {
  id: string | null;
  namespace: string;
  key: string;
  value: string;
  type: string;
}

export interface MetafieldGridRow {
  productId: string;
  title: string;
  handle: string;
  values: Record<string, ProductMetafieldValue>;
}

export interface MetafieldsListResponse {
  rows: MetafieldGridRow[];
  definitions: MetafieldDefinitionNode[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
}

export interface MetafieldUpdateInput {
  ownerId: string;
  namespace: string;
  key: string;
  type: string;
  value: string;
}

export interface MetafieldSaveResult {
  saved: number;
  errors: Array<{
    ownerId: string;
    namespace: string;
    key: string;
    message: string;
  }>;
}

export function metafieldColumnKey(namespace: string, key: string): string {
  return `${namespace}.${key}`;
}

export function parseMetafieldColumnKey(columnKey: string): {
  namespace: string;
  key: string;
} {
  const separatorIndex = columnKey.indexOf(".");
  if (separatorIndex <= 0) {
    return { namespace: columnKey, key: "" };
  }

  return {
    namespace: columnKey.slice(0, separatorIndex),
    key: columnKey.slice(separatorIndex + 1),
  };
}
