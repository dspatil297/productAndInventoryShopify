import type { Shop, ShopConfig } from "@/generated/prisma/client";
import { getShopAccessToken, updateShopConfig } from "@/lib/db/shops";
import {
  buildThemeProductLook,
  sectionFilenamesFromTemplate,
  snippetFilenamesFromLiquids,
  type ThemeProductLook,
} from "@/lib/products/theme-look";
import { orderedSectionLiquidsForTemplate, sharedPdpSectionLiquids } from "@/lib/products/theme-section-liquids";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import { themeSyncScopeError } from "@/lib/shopify/scopes";

export interface SyncedThemeProductTemplate {
  filename: string;
  /** null = default templates/product.json */
  suffix: string | null;
  label: string;
  updatedAt: string | null;
  /** Cached look from theme (colors + section order). Refresh via Sync. */
  look?: ThemeProductLook | null;
}

export interface SyncedThemeTemplatesState {
  syncedAt: string;
  themeId: string;
  themeName: string;
  /** Shared palette from settings_data (also copied onto each template.look). */
  colors?: ThemeProductLook["colors"];
  templates: SyncedThemeProductTemplate[];
}

const SETTINGS_KEY = "themeProductTemplates";
const SETTINGS_DATA_KEY = "config/settings_data.json";

interface ThemesGraphqlResponse {
  themes: {
    nodes: Array<{ id: string; name: string; role: string }>;
  };
}

interface ThemeFilesGraphqlResponse {
  theme: {
    files: {
      nodes: Array<{
        filename: string;
        body:
          | { content?: string; contentBase64?: string }
          | null
          | Record<string, never>;
      }>;
      /** OnlineStoreThemeFileReadResult — code + filename only (no message). */
      userErrors: Array<{ filename: string; code: string }>;
    };
  } | null;
}

const MAIN_THEME_QUERY = `
  query MainTheme {
    themes(first: 1, roles: [MAIN]) {
      nodes {
        id
        name
        role
      }
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
            ... on OnlineStoreThemeFileBodyText {
              content
            }
          }
        }
        userErrors {
          filename
          code
        }
      }
    }
  }
`;

function parseSuffix(filename: string): string | null {
  const match = /^templates\/product(?:\.([^/]+))?\.(?:json|liquid)$/i.exec(
    filename,
  );
  if (!match) {
    return null;
  }
  return match[1] ?? null;
}

function labelFor(_filename: string, suffix: string | null): string {
  if (!suffix) {
    return "Default product page";
  }
  return suffix
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function textBodyFromNode(
  body: ThemeFilesGraphqlResponse["theme"] extends null
    ? never
    : NonNullable<ThemeFilesGraphqlResponse["theme"]>["files"]["nodes"][0]["body"],
): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  if ("content" in body && typeof body.content === "string") {
    return body.content;
  }
  return null;
}

export function readSyncedThemeTemplates(
  config: ShopConfig | null | undefined,
): SyncedThemeTemplatesState | null {
  if (!config?.settings || typeof config.settings !== "object") {
    return null;
  }
  const raw = (config.settings as Record<string, unknown>)[SETTINGS_KEY];
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.templates) || typeof record.syncedAt !== "string") {
    return null;
  }
  return {
    syncedAt: record.syncedAt,
    themeId: typeof record.themeId === "string" ? record.themeId : "",
    themeName: typeof record.themeName === "string" ? record.themeName : "",
    colors:
      record.colors && typeof record.colors === "object"
        ? (record.colors as ThemeProductLook["colors"])
        : undefined,
    templates: record.templates.filter(
      (item): item is SyncedThemeProductTemplate =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as SyncedThemeProductTemplate).filename === "string",
    ),
  };
}

export function findSyncedTemplateLook(
  state: SyncedThemeTemplatesState | null,
  suffix: string,
): ThemeProductLook | null {
  if (!state) {
    return null;
  }
  const match = state.templates.find(
    (template) => (template.suffix ?? "") === suffix,
  );
  if (match?.look) {
    return {
      colors: match.look.colors,
      sections: match.look.sections ?? [],
      slots: match.look.slots ?? [],
    };
  }
  if (state.colors) {
    return { colors: state.colors, sections: [], slots: [] };
  }
  return null;
}

/**
 * Create: null until merchant picks a template (or URL has suffix).
 * Edit: use product's templateSuffix, else first synced template — skip picker.
 */
export function resolveVisualTemplateSuffix(input: {
  urlSuffix?: string;
  productTemplateSuffix?: string | null;
  themeTemplates?: SyncedThemeTemplatesState | null;
  forcePicker?: boolean;
  isEdit?: boolean;
}): string | null {
  if (input.forcePicker && input.urlSuffix === undefined) {
    return null;
  }
  if (input.urlSuffix !== undefined) {
    return input.urlSuffix;
  }
  if (!input.isEdit) {
    return null;
  }

  const fromProduct = input.productTemplateSuffix ?? "";
  const templates = input.themeTemplates?.templates ?? [];
  if (templates.length === 0) {
    return fromProduct;
  }

  const known = templates.some(
    (template) => (template.suffix ?? "") === fromProduct,
  );
  if (known) {
    return fromProduct;
  }

  return templates[0]?.suffix ?? "";
}

async function listThemeAssetKeys(
  shopDomain: string,
  accessToken: string,
  themeNumericId: string,
): Promise<Array<{ key: string; updated_at?: string }>> {
  const apiVersion = process.env.SHOPIFY_API_VERSION ?? "2026-07";
  const response = await fetch(
    `https://${shopDomain}/admin/api/${apiVersion}/themes/${themeNumericId}/assets.json`,
    {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(
      `Theme assets failed (${response.status}). Add read_themes scope and re-install the app.`,
    );
  }
  const payload = (await response.json()) as {
    assets?: Array<{ key: string; updated_at?: string }>;
  };
  return payload.assets ?? [];
}

function themeNumericIdFromGid(gid: string): string {
  const match = /OnlineStoreTheme\/(\d+)/.exec(gid);
  if (!match) {
    throw new Error(`Invalid theme id: ${gid}`);
  }
  return match[1];
}

async function fetchThemeFileBodies(
  shop: Shop,
  themeId: string,
  filenames: string[],
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (filenames.length === 0) {
    return result;
  }

  // Shopify accepts a batch; keep chunks small.
  const CHUNK = 20;
  for (let index = 0; index < filenames.length; index += CHUNK) {
    const chunk = filenames.slice(index, index + CHUNK);
    const data = await shopifyGraphqlForShop<ThemeFilesGraphqlResponse>(
      shop,
      THEME_FILES_QUERY,
      { themeId, filenames: chunk },
    );
    const readErrors = data.theme?.files.userErrors ?? [];
    const denied = readErrors.filter((error) => error.code === "ACCESS_DENIED");
    if (denied.length > 0) {
      throw new Error(
        `Theme file read denied (${denied.map((error) => error.filename).join(", ")}). Re-auth with read_themes.`,
      );
    }
    for (const node of data.theme?.files.nodes ?? []) {
      result.set(node.filename, textBodyFromNode(node.body));
    }
    for (const filename of chunk) {
      if (!result.has(filename)) {
        result.set(filename, null);
      }
    }
  }
  return result;
}

/**
 * Pull product templates + look (colors/sections) from published theme once.
 * Store on shop config. Does not run on every product create — merchant clicks Sync.
 */
export async function syncThemeProductTemplates(
  shop: Shop,
): Promise<SyncedThemeTemplatesState> {
  const data = await shopifyGraphqlForShop<ThemesGraphqlResponse>(
    shop,
    MAIN_THEME_QUERY,
  );
  const theme = data.themes.nodes[0];
  if (!theme) {
    throw new Error("No published (MAIN) theme found on this shop");
  }

  const accessToken = getShopAccessToken(shop);
  const assets = await listThemeAssetKeys(
    shop.shopDomain,
    accessToken,
    themeNumericIdFromGid(theme.id),
  );

  const productFiles = assets.filter((asset) =>
    /^templates\/product(?:\.[^/]+)?\.(?:json|liquid)$/i.test(asset.key),
  );

  const filenames = [
    SETTINGS_DATA_KEY,
    ...productFiles.map((asset) => asset.key),
  ];
  const bodies = await fetchThemeFileBodies(shop, theme.id, filenames);
  const settingsData = bodies.get(SETTINGS_DATA_KEY) ?? null;

  // Section Liquid holds real metafield bindings (JSON often has none)
  const sectionFileSet = new Set<string>();
  for (const asset of productFiles) {
    for (const name of sectionFilenamesFromTemplate(
      bodies.get(asset.key) ?? null,
    )) {
      sectionFileSet.add(name);
    }
  }
  // Always try common PDP section files
  for (const name of [
    "sections/main-product.liquid",
    "sections/product-information.liquid",
    "sections/product-details.liquid",
    "sections/craftsperson.liquid",
    "sections/how-its-made.liquid",
    "sections/how-it-s-made.liquid",
  ]) {
    sectionFileSet.add(name);
  }
  // Also any sections/*.liquid that look product-related from asset list
  for (const asset of assets) {
    if (
      /^sections\/.*(product|craft|made|promise|detail|jewell|jewelry|ethnic|sculpture|pdp|faq|maker)/i.test(
        asset.key,
      )
    ) {
      sectionFileSet.add(asset.key);
    }
  }

  const sectionBodies = await fetchThemeFileBodies(shop, theme.id, [
    ...sectionFileSet,
  ]);
  const liquidByFilename = new Map<string, string>();
  for (const [filename, body] of sectionBodies.entries()) {
    if (typeof body === "string") {
      liquidByFilename.set(filename, body);
    }
  }

  // Snippets referenced by any product template section
  const snippetPass = new Set<string>();
  for (const name of snippetFilenamesFromLiquids(
    [...liquidByFilename.entries()].map(([filename, body]) => ({
      filename,
      body,
    })),
  )) {
    snippetPass.add(name);
  }
  if (snippetPass.size > 0) {
    const snippetBodies = await fetchThemeFileBodies(shop, theme.id, [
      ...snippetPass,
    ]);
    for (const [filename, body] of snippetBodies.entries()) {
      if (typeof body === "string") {
        liquidByFilename.set(filename, body);
      }
    }
    for (const nested of snippetFilenamesFromLiquids(
      [...liquidByFilename.entries()]
        .filter(([filename]) => filename.startsWith("snippets/"))
        .map(([filename, body]) => ({ filename, body })),
    )) {
      if (!liquidByFilename.has(nested)) {
        const nestedBodies = await fetchThemeFileBodies(shop, theme.id, [nested]);
        const nestedBody = nestedBodies.get(nested);
        if (typeof nestedBody === "string") {
          liquidByFilename.set(nested, nestedBody);
        }
      }
    }
  }

  const templates: SyncedThemeProductTemplate[] = productFiles.map((asset) => {
    const suffix = parseSuffix(asset.key);
    const templateBody = bodies.get(asset.key) ?? null;
    let sectionLiquids = orderedSectionLiquidsForTemplate(
      templateBody,
      liquidByFilename,
      asset.key,
    );
    let look = buildThemeProductLook({
      settingsData,
      templateBody,
      sectionLiquids,
    });
    if (!look.slots.some((slot) => slot.kind === "metafield")) {
      sectionLiquids = sharedPdpSectionLiquids(liquidByFilename, asset.key);
      look = buildThemeProductLook({
        settingsData,
        templateBody,
        sectionLiquids,
      });
    }
    return {
      filename: asset.key,
      suffix,
      label: labelFor(asset.key, suffix),
      updatedAt: asset.updated_at ?? null,
      look,
    };
  });

  if (!templates.some((template) => template.suffix === null)) {
    let sectionLiquids = orderedSectionLiquidsForTemplate(
      null,
      liquidByFilename,
      "templates/product.json",
    );
    let look = buildThemeProductLook({
      settingsData,
      templateBody: null,
      sectionLiquids,
    });
    if (!look.slots.some((slot) => slot.kind === "metafield")) {
      sectionLiquids = sharedPdpSectionLiquids(liquidByFilename);
      look = buildThemeProductLook({
        settingsData,
        templateBody: null,
        sectionLiquids,
      });
    }
    templates.unshift({
      filename: "templates/product.json",
      suffix: null,
      label: "Default product page",
      updatedAt: null,
      look,
    });
  }

  templates.sort((left, right) => {
    if (left.suffix === null) {
      return -1;
    }
    if (right.suffix === null) {
      return 1;
    }
    return left.label.localeCompare(right.label);
  });

  const sharedColors = buildThemeProductLook({
    settingsData,
    templateBody: null,
  }).colors;

  const state: SyncedThemeTemplatesState = {
    syncedAt: new Date().toISOString(),
    themeId: theme.id,
    themeName: theme.name,
    colors: sharedColors,
    templates,
  };

  await updateShopConfig(shop.id, {
    settings: { [SETTINGS_KEY]: state },
  });

  return state;
}
