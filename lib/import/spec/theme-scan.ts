import type { Shop } from "@/generated/prisma/client";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import {
  scanThemeLiquidForMetafields,
  type ThemeMetafieldUsage,
} from "@/lib/import/spec/schema-discovery";

const MAIN_THEME_QUERY = `
  query MainTheme {
    themes(first: 1, roles: [MAIN]) {
      nodes { id name }
    }
  }
`;

const THEME_FILES_QUERY = `
  query ThemeFiles($themeId: ID!, $filenames: [String!]!) {
    theme(id: $themeId) {
      files(first: 100, filenames: $filenames) {
        nodes {
          filename
          body {
            ... on OnlineStoreThemeFileBodyText { content }
          }
        }
      }
    }
  }
`;

const SAMPLE_PRODUCTS_METAFIELDS_QUERY = `
  query SampleProductMetafields {
    products(first: 3, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        metafields(first: 30) {
          nodes {
            namespace
            key
            value
          }
        }
      }
    }
  }
`;

const THEME_SCAN_PATTERNS = [
  "templates/product*.json",
  "sections/*product*.liquid",
  "snippets/*pdp*.liquid",
  "snippets/*product*.liquid",
  "snippets/*accordion*.liquid",
  "snippets/*metafield*.liquid",
];

interface MainThemeResponse {
  themes: { nodes: Array<{ id: string; name: string }> };
}

interface ThemeFilesResponse {
  theme: {
    files: {
      nodes: Array<{
        filename: string;
        body: { content?: string } | null | Record<string, never>;
      }>;
    };
  } | null;
}

interface SampleProductsResponse {
  products: {
    nodes: Array<{
      metafields: {
        nodes: Array<{ namespace: string; key: string; value: string }>;
      };
    }>;
  };
}

function bodyContent(
  body: ThemeFilesResponse["theme"] extends null
    ? never
    : NonNullable<ThemeFilesResponse["theme"]>["files"]["nodes"][0]["body"],
): string {
  if (!body || typeof body !== "object" || !("content" in body)) {
    return "";
  }
  return typeof body.content === "string" ? body.content : "";
}

export async function discoverThemeMetafields(
  shop: Shop,
): Promise<Map<string, ThemeMetafieldUsage>> {
  const themeData = await shopifyGraphqlForShop<MainThemeResponse>(
    shop,
    MAIN_THEME_QUERY,
  );
  const themeId = themeData.themes.nodes[0]?.id;
  if (!themeId) {
    return new Map<string, ThemeMetafieldUsage>();
  }

  const filesData = await shopifyGraphqlForShop<ThemeFilesResponse>(
    shop,
    THEME_FILES_QUERY,
    { themeId, filenames: THEME_SCAN_PATTERNS },
  );

  const liquidContents: Array<{ filename: string; content: string }> = [];
  for (const node of filesData.theme?.files.nodes ?? []) {
    const content = bodyContent(node.body);
    if (content) {
      liquidContents.push({ filename: node.filename, content });
    }
  }

  return scanThemeLiquidForMetafields(liquidContents);
}

export async function sampleStoreProductMetafields(
  shop: Shop,
): Promise<Map<string, string[]>> {
  const samples = new Map<string, string[]>();
  const data = await shopifyGraphqlForShop<SampleProductsResponse>(
    shop,
    SAMPLE_PRODUCTS_METAFIELDS_QUERY,
  );
  for (const product of data.products.nodes) {
    for (const mf of product.metafields.nodes) {
      const id = `${mf.namespace}.${mf.key}`;
      const list = samples.get(id) ?? [];
      const snippet = mf.value.replace(/\s+/g, " ").trim().slice(0, 160);
      if (snippet && list.length < 2 && !list.includes(snippet)) {
        list.push(snippet);
        samples.set(id, list);
      }
    }
  }
  return samples;
}
