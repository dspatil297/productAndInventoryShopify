import type { Shop } from "@/generated/prisma/client";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import { scanThemeLiquidForMetafields } from "@/lib/import/spec/schema-discovery";

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
      files(filenames: $filenames) {
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

const THEME_SCAN_PATHS = [
  "snippets/pdp-accordions.liquid",
  "snippets/pdp-content-resolve.liquid",
  "sections/main-product.liquid",
  "templates/product.json",
  "templates/product.paintings.json",
  "templates/product.ethnic-wear.json",
  "templates/product.jewellery.json",
  "templates/product.sculpture.json",
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

export async function discoverThemeMetafields(shop: Shop) {
  const themeData = await shopifyGraphqlForShop<MainThemeResponse>(
    shop,
    MAIN_THEME_QUERY,
  );
  const themeId = themeData.themes.nodes[0]?.id;
  if (!themeId) {
    return new Map<string, { theme_files: string[] }>();
  }

  const filesData = await shopifyGraphqlForShop<ThemeFilesResponse>(
    shop,
    THEME_FILES_QUERY,
    { themeId, filenames: THEME_SCAN_PATHS },
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
