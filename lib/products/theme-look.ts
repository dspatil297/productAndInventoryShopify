/**
 * Parse published-theme settings + product template JSON into a fill-canvas look.
 * Slots follow theme section/block order so fields sit where the PDP puts them.
 * Ceiling: not full Liquid render — structure + colors from JSON templates.
 */

export interface ThemeLookColors {
  background: string;
  text: string;
  muted: string;
  buttonBg: string;
  buttonText: string;
  border: string;
}

export interface ThemeLookSection {
  key: string;
  type: string;
  label: string;
  kind: "product_main" | "content" | "other";
}

/** One fillable (or placeholder) spot on the PDP canvas, in theme order. */
export type ThemePdpSlotKind =
  | "media"
  | "title"
  | "price"
  | "buy"
  | "description"
  | "metafield"
  | "placeholder";

export type ThemePdpSlotColumn = "media" | "info" | "full";

/** How metafield renders on canvas. */
export type ThemePdpMetafieldDisplay =
  | "table_row"
  | "accordion"
  | "section"
  | "json_kv"
  | "json_faq"
  | "json_object";

export interface ThemePdpSlot {
  id: string;
  kind: ThemePdpSlotKind;
  label: string;
  column: ThemePdpSlotColumn;
  metafieldNamespace?: string;
  metafieldKey?: string;
  matchName?: string;
  metafieldDisplay?: ThemePdpMetafieldDisplay;
}

export interface ThemeProductLook {
  colors: ThemeLookColors;
  sections: ThemeLookSection[];
  /** Ordered PDP fill slots from template JSON (empty if liquid-only / old sync). */
  slots: ThemePdpSlot[];
}

export const DEFAULT_THEME_LOOK_COLORS: ThemeLookColors = {
  background: "#f4f1ea",
  text: "#1a1a1a",
  muted: "#737373",
  buttonBg: "#1a1a1a",
  buttonText: "#f4f1ea",
  border: "#d4d4d4",
};

function asHex(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(trimmed);
  if (!match) {
    return null;
  }
  const hex = match[1];
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase();
  }
  return `#${hex.slice(0, 6)}`.toLowerCase();
}

function firstHex(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    const hex = asHex(candidate);
    if (hex) {
      return hex;
    }
  }
  return null;
}

function labelFromType(type: string): string {
  return type
    .replace(/[@]/g, "")
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function sectionKind(type: string): ThemeLookSection["kind"] {
  const normalized = type.toLowerCase();
  if (
    normalized.includes("main-product") ||
    normalized === "product" ||
    normalized.includes("product-information") ||
    normalized.includes("product-details") ||
    /^product[-_]/.test(normalized) ||
    normalized.includes("pdp")
  ) {
    if (
      normalized.includes("product-grid") ||
      normalized.includes("product-card") ||
      normalized.includes("product-list") ||
      normalized.includes("product-recommendations")
    ) {
      return "other";
    }
    return "product_main";
  }
  if (
    normalized.includes("rich-text") ||
    normalized.includes("collapsible") ||
    normalized.includes("multirow") ||
    normalized.includes("image-with-text") ||
    normalized.includes("featured")
  ) {
    return "content";
  }
  return "other";
}

/** Pull palette from config/settings_data.json (Dawn schemes + legacy keys). */
export function parseThemeColorsFromSettingsData(
  raw: string | null | undefined,
): ThemeLookColors {
  if (!raw) {
    return { ...DEFAULT_THEME_LOOK_COLORS };
  }
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const current = data.current;
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return { ...DEFAULT_THEME_LOOK_COLORS };
    }
    const settings = current as Record<string, unknown>;

    const schemes = settings.color_schemes;
    if (schemes && typeof schemes === "object" && !Array.isArray(schemes)) {
      const firstScheme = Object.values(schemes)[0] as
        | { settings?: Record<string, unknown> }
        | undefined;
      const scheme = firstScheme?.settings ?? {};
      return {
        background:
          firstHex(scheme.background, scheme.background_gradient) ??
          DEFAULT_THEME_LOOK_COLORS.background,
        text: firstHex(scheme.text) ?? DEFAULT_THEME_LOOK_COLORS.text,
        muted: firstHex(scheme.text) ?? DEFAULT_THEME_LOOK_COLORS.muted,
        buttonBg:
          firstHex(scheme.button, scheme.primary_button) ??
          DEFAULT_THEME_LOOK_COLORS.buttonBg,
        buttonText:
          firstHex(scheme.button_label, scheme.primary_button_label) ??
          DEFAULT_THEME_LOOK_COLORS.buttonText,
        border:
          firstHex(scheme.border, scheme.text) ??
          DEFAULT_THEME_LOOK_COLORS.border,
      };
    }

    return {
      background:
        firstHex(
          settings.colors_background_1,
          settings.color_background,
          settings.background,
        ) ?? DEFAULT_THEME_LOOK_COLORS.background,
      text:
        firstHex(settings.colors_text, settings.color_text, settings.text) ??
        DEFAULT_THEME_LOOK_COLORS.text,
      muted:
        firstHex(settings.colors_text, settings.color_text) ??
        DEFAULT_THEME_LOOK_COLORS.muted,
      buttonBg:
        firstHex(
          settings.colors_accent_1,
          settings.colors_button,
          settings.color_primary,
        ) ?? DEFAULT_THEME_LOOK_COLORS.buttonBg,
      buttonText:
        firstHex(
          settings.colors_solid_button_labels,
          settings.color_primary_button_labels,
        ) ?? DEFAULT_THEME_LOOK_COLORS.buttonText,
      border:
        firstHex(settings.colors_text, settings.color_text) ??
        DEFAULT_THEME_LOOK_COLORS.border,
    };
  } catch {
    return { ...DEFAULT_THEME_LOOK_COLORS };
  }
}

interface TemplateSectionNode {
  type?: string;
  disabled?: boolean;
  name?: string;
  settings?: Record<string, unknown>;
  blocks?: Record<
    string,
    {
      type?: string;
      disabled?: boolean;
      settings?: Record<string, unknown>;
    }
  >;
  block_order?: string[];
}

function parseTemplateJson(raw: string): {
  sections: Record<string, TemplateSectionNode>;
  order: string[];
} | null {
  if (!raw.trim().startsWith("{")) {
    return null;
  }
  try {
    const data = JSON.parse(raw) as {
      sections?: Record<string, TemplateSectionNode>;
      order?: string[];
    };
    if (!data.sections || typeof data.sections !== "object") {
      return null;
    }
    const order =
      Array.isArray(data.order) && data.order.length > 0
        ? data.order
        : Object.keys(data.sections);
    return { sections: data.sections, order };
  } catch {
    return null;
  }
}

/** Section order from templates/product*.json (OS 2.0). Liquid-only → empty. */
export function parseTemplateSections(
  raw: string | null | undefined,
): ThemeLookSection[] {
  if (!raw) {
    return [];
  }
  const parsed = parseTemplateJson(raw);
  if (!parsed) {
    return [];
  }

  const sections: ThemeLookSection[] = [];
  for (const key of parsed.order) {
    const section = parsed.sections[key];
    if (!section || section.disabled || typeof section.type !== "string") {
      continue;
    }
    sections.push({
      key,
      type: section.type,
      label:
        typeof section.name === "string" && section.name.trim()
          ? section.name.trim()
          : labelFromType(section.type),
      kind: sectionKind(section.type),
    });
  }
  return sections;
}

function collectStringValues(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringValues(item, out);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectStringValues(nested, out);
    }
  }
}

/** Extract namespace/key pairs from theme setting strings / dynamic sources. */
export function extractMetafieldRefs(
  settings: Record<string, unknown> | undefined,
): Array<{ namespace: string; key: string }> {
  if (!settings) {
    return [];
  }
  const strings: string[] = [];
  collectStringValues(settings, strings);
  const found: Array<{ namespace: string; key: string }> = [];
  const seen = new Set<string>();

  for (const text of strings) {
    const patterns = [
      /shopify:\/\/product[_/]?metafields\/([^/\s"'{}]+)\/([^/\s"'{}]+)/gi,
      /product\.metafields\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/gi,
    ];
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const namespace = match[1];
        const key = match[2];
        const id = `${namespace}.${key}`;
        if (seen.has(id)) {
          continue;
        }
        seen.add(id);
        found.push({ namespace, key });
      }
    }
  }
  return found;
}

function headingFromSettings(
  settings: Record<string, unknown> | undefined,
): string | null {
  if (!settings) {
    return null;
  }
  for (const key of ["heading", "title", "accordion_title", "label", "name"]) {
    const value = settings[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function isBelowFoldBlockType(type: string): boolean {
  const normalized = type.toLowerCase();
  return (
    normalized.includes("collapsible") ||
    normalized.includes("accordion") ||
    normalized.includes("tab") ||
    normalized.includes("description") ||
    normalized.includes("rich-text") ||
    normalized.includes("multirow") ||
    normalized.includes("image-with-text")
  );
}

function mapBlockToSlots(
  blockId: string,
  block: {
    type?: string;
    disabled?: boolean;
    settings?: Record<string, unknown>;
  },
  isMain: boolean,
): ThemePdpSlot[] {
  if (!block.type || block.disabled) {
    return [];
  }
  const type = block.type.toLowerCase();
  const heading = headingFromSettings(block.settings);
  const refs = extractMetafieldRefs(block.settings);
  const below = !isMain || isBelowFoldBlockType(type);
  const column: ThemePdpSlotColumn = below ? "full" : "info";
  const slots: ThemePdpSlot[] = [];

  if (type === "title" || type.endsWith("/title")) {
    slots.push({
      id: `${blockId}:title`,
      kind: "title",
      label: "Title",
      column: "info",
    });
    return slots;
  }
  if (type === "price" || type.endsWith("/price")) {
    slots.push({
      id: `${blockId}:price`,
      kind: "price",
      label: "Price",
      column: "info",
    });
    return slots;
  }
  if (
    type === "buy_buttons" ||
    type.includes("buy-button") ||
    type.includes("buy_button")
  ) {
    slots.push({
      id: `${blockId}:buy`,
      kind: "buy",
      label: "Add to cart",
      column: "info",
    });
    return slots;
  }
  if (type === "description" || type.endsWith("/description")) {
    slots.push({
      id: `${blockId}:description`,
      kind: "description",
      label: "Description",
      column: "full",
    });
    return slots;
  }
  if (
    type.includes("variant") ||
    type.includes("quantity") ||
    type.includes("share") ||
    type.includes("payment") ||
    type.includes("pickup") ||
    type.includes("inventory") ||
    type === "sku"
  ) {
    // Skip chrome — not product content fields
    return slots;
  }

  // Only real PDP metafield bindings — no speculative dump of every text block
  if (refs.length > 0) {
    for (const ref of refs) {
      if (!isPdpVisibleMetafieldKey(ref.key)) {
        continue;
      }
      slots.push({
        id: `${blockId}:mf:${ref.namespace}.${ref.key}`,
        kind: "metafield",
        label: heading ?? `${ref.namespace}.${ref.key}`,
        column,
        metafieldNamespace: ref.namespace,
        metafieldKey: ref.key,
        matchName: heading ?? undefined,
        metafieldDisplay: below ? "accordion" : "table_row",
      });
    }
    return slots;
  }

  // Collapsible / accordion with heading → below; match metafield by heading only
  if (
    heading &&
    (type.includes("collapsible") ||
      type.includes("accordion") ||
      type.includes("tab") ||
      type.includes("metafield"))
  ) {
    slots.push({
      id: `${blockId}:mf-match`,
      kind: "metafield",
      label: heading,
      column: "full",
      matchName: heading,
      metafieldDisplay: "accordion",
    });
  }

  return slots;
}

/**
 * Build ordered PDP slots from product template JSON (main-product blocks + below sections).
 * Info = beside image; full = below image row. No invented fields — only theme-linked.
 */
export function parseTemplateSlots(
  raw: string | null | undefined,
): ThemePdpSlot[] {
  if (!raw) {
    return [];
  }
  const parsed = parseTemplateJson(raw);
  if (!parsed) {
    return [];
  }

  const slots: ThemePdpSlot[] = [];
  let mediaAdded = false;

  for (const sectionKey of parsed.order) {
    const section = parsed.sections[sectionKey];
    if (!section || section.disabled || typeof section.type !== "string") {
      continue;
    }
    const kind = sectionKind(section.type);
    const isMain = kind === "product_main";

    if (isMain && !mediaAdded) {
      slots.push({
        id: `${sectionKey}:media`,
        kind: "media",
        label: "Product image",
        column: "media",
      });
      mediaAdded = true;
    }

    const blockOrder =
      Array.isArray(section.block_order) && section.block_order.length > 0
        ? section.block_order
        : Object.keys(section.blocks ?? {});

    if (blockOrder.length > 0 && section.blocks) {
      for (const blockId of blockOrder) {
        const block = section.blocks[blockId];
        if (!block) {
          continue;
        }
        slots.push(...mapBlockToSlots(blockId, block, isMain));
      }
      continue;
    }

    // Below-fold sections: only if they bind metafields (skip pure decorative)
    if (!isMain) {
      const refs = extractMetafieldRefs(section.settings);
      const heading =
        headingFromSettings(section.settings) ??
        (typeof section.name === "string" ? section.name : null);
      if (refs.length > 0) {
        for (const ref of refs) {
          slots.push({
            id: `${sectionKey}:mf:${ref.namespace}.${ref.key}`,
            kind: "metafield",
            label: heading ?? `${ref.namespace}.${ref.key}`,
            column: "full",
            metafieldNamespace: ref.namespace,
            metafieldKey: ref.key,
            matchName: heading ?? undefined,
            metafieldDisplay: "accordion",
          });
        }
      }
    }
  }

  // Ensure core buy path exists beside image even if theme omitted typed blocks
  if (!slots.some((slot) => slot.kind === "title")) {
    slots.splice(mediaAdded ? 1 : 0, 0, {
      id: "core:title",
      kind: "title",
      label: "Title",
      column: "info",
    });
  }
  if (!slots.some((slot) => slot.kind === "price")) {
    const titleIndex = slots.findIndex((slot) => slot.kind === "title");
    slots.splice(titleIndex + 1, 0, {
      id: "core:price",
      kind: "price",
      label: "Price",
      column: "info",
    });
  }
  if (!slots.some((slot) => slot.kind === "buy")) {
    const priceIndex = slots.findIndex((slot) => slot.kind === "price");
    slots.splice(priceIndex + 1, 0, {
      id: "core:buy",
      kind: "buy",
      label: "Add to cart",
      column: "info",
    });
  }

  return slots;
}

export function buildThemeProductLook(input: {
  settingsData: string | null;
  templateBody: string | null;
  sectionLiquids?: Array<{ filename: string; body: string }>;
}): ThemeProductLook {
  const fromJson = parseTemplateSlots(input.templateBody);
  const fromLiquid = parseLiquidMetafieldSlots(input.sectionLiquids ?? []);
  const slots = mergeSlots(fromJson, fromLiquid);

  return {
    colors: parseThemeColorsFromSettingsData(input.settingsData),
    sections: parseTemplateSections(input.templateBody),
    slots,
  };
}

/** Section types used by a product JSON template → filenames to fetch. */
export function sectionFilenamesFromTemplate(
  templateBody: string | null | undefined,
): string[] {
  if (!templateBody) {
    return [];
  }
  const parsed = parseTemplateJson(templateBody);
  if (!parsed) {
    return [];
  }
  const types = new Set<string>();
  for (const section of Object.values(parsed.sections)) {
    if (section?.type && !section.disabled) {
      // App blocks like "shopify://apps/..." — skip
      if (section.type.includes("://")) {
        continue;
      }
      types.add(section.type);
    }
  }
  return [...types].map((type) => `sections/${type}.liquid`);
}

/** Snippets referenced via {% render 'name' %} / {% include "name" %}. */
export function snippetFilenamesFromLiquids(
  liquids: Array<{ filename: string; body: string }>,
): string[] {
  const names = new Set<string>();
  const pattern = /\{%[-\s]*(?:render|include)\s+['"]([^'"]+)['"]/gi;
  for (const file of liquids) {
    if (!file.body) {
      continue;
    }
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(file.body)) !== null) {
      const name = match[1]?.trim();
      if (name) {
        names.add(`snippets/${name}.liquid`);
      }
    }
  }
  return [...names];
}

interface LiquidMetafieldHit {
  namespace: string;
  key: string;
  label: string;
  column: ThemePdpSlotColumn;
  metafieldDisplay: ThemePdpMetafieldDisplay;
  order: number;
}

const METAFIELD_REF_PATTERNS = [
  /product\.metafields\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/g,
  /product\.metafields\[['"]([^'"]+)['"]\]\[['"]([^'"]+)['"]\]/g,
  /product\.metafields\[['"]([^'"]+)['"]\]\.([a-zA-Z0-9_]+)/g,
];

const METAFIELD_LOOP_PATTERN =
  /for\s+\w+\s+in\s+product\.metafields\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)(?:\.value)?/gi;

const METAFIELD_LOOP_BRACKET_PATTERN =
  /for\s+\w+\s+in\s+product\.metafields\[['"]([^'"]+)['"]\]\[['"]([^'"]+)['"]\](?:\.value)?/gi;

/** Collection filters / reviews / test keys — not on merchant PDP canvas. */
export function isPdpVisibleMetafieldKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (lower.startsWith("filter_")) {
    return false;
  }
  if (/^rating(_count)?$/.test(lower) || lower.includes("review")) {
    return false;
  }
  if (lower.startsWith("test_data") || lower.startsWith("seo_")) {
    return false;
  }
  return true;
}

function headingNearLiquid(body: string, index: number): string | null {
  const start = Math.max(0, index - 600);
  const nearby = body.slice(start, index + 120);
  const patterns = [
    /<summary[^>]*>\s*([^<{]+?)\s*<\/summary>/i,
    /<h[1-6][^>]*>\s*([^<{]+?)\s*<\/h[1-6]>/i,
    /(?:heading|title|label|accordion_title)\s*[:=]\s*['"]([^'"]+)['"]/i,
    />\s*([A-Z][^<{]{2,48})\s*</,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(nearby);
    const text = match?.[1]?.trim();
    if (text && text.length > 1) {
      return text;
    }
  }
  return null;
}

function liquidContextAt(
  body: string,
  index: number,
  sectionColumn: ThemePdpSlotColumn,
): { column: ThemePdpSlotColumn; metafieldDisplay: ThemePdpMetafieldDisplay } {
  const before = body.slice(Math.max(0, index - 900), index);
  const inDetails =
    /<details\b/i.test(before) &&
    !/<\/details>/i.test(before.slice(before.lastIndexOf("<details")));
  const inCollapsible =
    /collapsible|accordion|tab-item|disclosure/i.test(before.slice(-500));
  const inTable =
    /<table\b/i.test(before) &&
    !/<\/table>/i.test(before.slice(before.lastIndexOf("<table")));
  const inProductDetails =
    /product[-_ ]?details|details[-_ ]?row|spec[-_ ]?row/i.test(
      before.slice(-400),
    );

  if (sectionColumn === "full") {
    if (inTable || inProductDetails) {
      return { column: "full", metafieldDisplay: "section" };
    }
    if (inDetails || inCollapsible) {
      return { column: "full", metafieldDisplay: "accordion" };
    }
    return { column: "full", metafieldDisplay: "section" };
  }

  // Main column: accordions + KV blocks stay beside the image (live PDP)
  if (inDetails || inCollapsible) {
    return { column: "info", metafieldDisplay: "accordion" };
  }
  if (inTable || inProductDetails) {
    return { column: "info", metafieldDisplay: "table_row" };
  }
  return { column: "info", metafieldDisplay: "accordion" };
}

function jsonDisplayFromLoopBody(
  loopBody: string,
): ThemePdpMetafieldDisplay {
  if (
    /\bitem\.(q|question)\b/i.test(loopBody) &&
    /\bitem\.(a|answer)\b/i.test(loopBody)
  ) {
    return "json_faq";
  }
  if (
    /\bitem\.(label|key|attribute)\b/i.test(loopBody) &&
    /\bitem\.(value|data)\b/i.test(loopBody)
  ) {
    return "json_kv";
  }
  // Fixed schema keys in Liquid (title/body, title/description, …)
  if (
    /\bitem\.(title|name|heading|quote|bio)\b/i.test(loopBody) ||
    /\bitem\.(body|description|text|content|story)\b/i.test(loopBody)
  ) {
    return "json_object";
  }
  if (/\bfor\s+\w+\s+in\s+/.test(loopBody)) {
    return "json_kv";
  }
  return "json_kv";
}

function jsonDisplayFromKey(key: string): ThemePdpMetafieldDisplay {
  const hint = key.toLowerCase();
  if (/faq|question/.test(hint)) {
    return "json_faq";
  }
  if (/maker|craft|story|quote|bio|person|heritage|promise|process/.test(hint)) {
    return "json_object";
  }
  if (/detail|measurement|spec|included|attribute|dimension/.test(hint)) {
    return "json_kv";
  }
  return "json_kv";
}

/**
 * Pull metafield bindings from section/snippet Liquid in file order.
 * Placement from Liquid structure (table / details / section), not store labels.
 */
export function parseLiquidMetafieldSlots(
  files: Array<{
    filename: string;
    body: string;
    column?: ThemePdpSlotColumn;
  }>,
): ThemePdpSlot[] {
  const hits: LiquidMetafieldHit[] = [];
  const seen = new Set<string>();
  let fileOrder = 0;

  for (const file of files) {
    const body = file.body;
    if (!body) {
      fileOrder += 1;
      continue;
    }
    const sectionColumn: ThemePdpSlotColumn =
      file.column ??
      (/main-product|product-information/i.test(file.filename)
        ? "info"
        : "full");

    // JSON list loops: one metafield → kv/faq editor block
    for (const loopPattern of [
      METAFIELD_LOOP_PATTERN,
      METAFIELD_LOOP_BRACKET_PATTERN,
    ]) {
      loopPattern.lastIndex = 0;
      let loopMatch: RegExpExecArray | null;
      while ((loopMatch = loopPattern.exec(body)) !== null) {
      const namespace = loopMatch[1];
      const key = loopMatch[2];
      if (!isPdpVisibleMetafieldKey(key)) {
        continue;
      }
      const id = `${namespace}.${key}`;
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      const loopEnd = body.indexOf("{% endfor", loopMatch.index);
      const loopBody =
        loopEnd > loopMatch.index
          ? body.slice(loopMatch.index, loopEnd)
          : body.slice(loopMatch.index, loopMatch.index + 400);
      const label =
        headingNearLiquid(body, loopMatch.index) ?? key.replace(/_/g, " ");
      const jsonDisplay = jsonDisplayFromLoopBody(loopBody);
      const placement = liquidContextAt(body, loopMatch.index, sectionColumn);
      hits.push({
        namespace,
        key,
        label,
        column: placement.column,
        metafieldDisplay:
          jsonDisplay === "json_faq"
            ? "json_faq"
            : jsonDisplay === "json_kv"
              ? "json_kv"
              : placement.metafieldDisplay,
        order: fileOrder * 100_000 + loopMatch.index,
      });
      }
    }

    for (const refPattern of METAFIELD_REF_PATTERNS) {
      refPattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = refPattern.exec(body)) !== null) {
        const namespace = match[1];
        const key = match[2];
        if (key === "value" || key === "type") {
          continue;
        }
        if (!isPdpVisibleMetafieldKey(key)) {
          continue;
        }
        const id = `${namespace}.${key}`;
        if (seen.has(id)) {
          continue;
        }
        seen.add(id);

        const label =
          headingNearLiquid(body, match.index) ?? key.replace(/_/g, " ");
        const placement = liquidContextAt(body, match.index, sectionColumn);
        let metafieldDisplay = placement.metafieldDisplay;
        if (/\.value\b/.test(body.slice(match.index, match.index + 40))) {
          metafieldDisplay = jsonDisplayFromKey(key);
        }

        hits.push({
          namespace,
          key,
          label,
          column: placement.column,
          metafieldDisplay,
          order: fileOrder * 100_000 + match.index,
        });
      }
    }
    fileOrder += 1;
  }

  hits.sort((left, right) => left.order - right.order);

  return hits.map((hit) => ({
    id: `liquid:${hit.namespace}.${hit.key}`,
    kind: "metafield" as const,
    label: hit.label,
    column: hit.column,
    metafieldNamespace: hit.namespace,
    metafieldKey: hit.key,
    matchName: hit.label,
    metafieldDisplay: hit.metafieldDisplay,
  }));
}

function mfSlotKey(slot: ThemePdpSlot): string | null {
  return slot.metafieldNamespace && slot.metafieldKey
    ? `${slot.metafieldNamespace}.${slot.metafieldKey}`
    : null;
}

function mergeMetafieldLists(
  primary: ThemePdpSlot[],
  secondary: ThemePdpSlot[],
  seen: Set<string>,
): ThemePdpSlot[] {
  const merged: ThemePdpSlot[] = [];
  for (const slot of primary) {
    const key = mfSlotKey(slot);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(slot);
  }
  for (const slot of secondary) {
    const key = mfSlotKey(slot);
    if (!key) {
      continue;
    }
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(slot);
      continue;
    }
    const index = merged.findIndex((item) => mfSlotKey(item) === key);
    if (index >= 0) {
      merged[index] = { ...merged[index], ...slot, id: merged[index].id };
    }
  }
  return merged;
}

function mergeSlots(
  fromJson: ThemePdpSlot[],
  fromLiquid: ThemePdpSlot[],
): ThemePdpSlot[] {
  const seen = new Set<string>();
  const core = fromJson.filter((slot) =>
    ["media", "title", "price", "buy"].includes(slot.kind),
  );
  const description = fromJson.find((slot) => slot.kind === "description");

  const sidebarMfs = mergeMetafieldLists(
    fromJson.filter(
      (slot) => slot.kind === "metafield" && slot.column !== "full",
    ),
    fromLiquid.filter(
      (slot) => slot.kind === "metafield" && slot.column !== "full",
    ),
    seen,
  );
  const belowMfs = mergeMetafieldLists(
    fromJson.filter(
      (slot) => slot.kind === "metafield" && slot.column === "full",
    ),
    fromLiquid.filter(
      (slot) => slot.kind === "metafield" && slot.column === "full",
    ),
    seen,
  );

  const buyIndex = core.findIndex((slot) => slot.kind === "buy");
  const insertAt = buyIndex >= 0 ? buyIndex + 1 : core.length;
  const merged: ThemePdpSlot[] = [
    ...core.slice(0, insertAt),
    ...sidebarMfs,
    ...core.slice(insertAt),
  ];

  if (description) {
    if (description.column === "full") {
      belowMfs.unshift(description);
    } else {
      merged.push(description);
    }
  }
  merged.push(...belowMfs);

  if (!merged.some((slot) => slot.kind === "media")) {
    merged.unshift({
      id: "core:media",
      kind: "media",
      label: "Product image",
      column: "media",
    });
  }
  if (!merged.some((slot) => slot.kind === "title")) {
    const mediaIndex = merged.findIndex((slot) => slot.kind === "media");
    merged.splice(mediaIndex + 1, 0, {
      id: "core:title",
      kind: "title",
      label: "Title",
      column: "info",
    });
  }
  if (!merged.some((slot) => slot.kind === "price")) {
    const titleIndex = merged.findIndex((slot) => slot.kind === "title");
    merged.splice(titleIndex + 1, 0, {
      id: "core:price",
      kind: "price",
      label: "Price",
      column: "info",
    });
  }
  if (!merged.some((slot) => slot.kind === "buy")) {
    const priceIndex = merged.findIndex((slot) => slot.kind === "price");
    merged.splice(priceIndex + 1, 0, {
      id: "core:buy",
      kind: "buy",
      label: "Add to cart",
      column: "info",
    });
  }

  return merged;
}

/** Tiny self-check — fails loud if look/slot parsing regresses. */
export function assertThemeLookParserOk(): void {
  const colors = parseThemeColorsFromSettingsData(
    JSON.stringify({
      current: {
        color_schemes: {
          "scheme-1": {
            settings: {
              background: "#ffffff",
              text: "#111111",
              button: "#222222",
              button_label: "#eeeeee",
              border: "#cccccc",
            },
          },
        },
      },
    }),
  );
  if (colors.background !== "#ffffff" || colors.buttonBg !== "#222222") {
    throw new Error("theme-look: color scheme parse failed");
  }

  const sections = parseTemplateSections(
    JSON.stringify({
      sections: {
        main: { type: "main-product" },
        story: { type: "rich-text", name: "Story" },
        skip: { type: "apps", disabled: true },
      },
      order: ["main", "story", "skip"],
    }),
  );
  if (
    sections.length !== 2 ||
    sections[0].kind !== "product_main" ||
    sections[1].label !== "Story"
  ) {
    throw new Error("theme-look: section parse failed");
  }

  const liquidSlots = parseLiquidMetafieldSlots([
    {
      filename: "sections/main-product.liquid",
      body: `
        {{ product.metafields.custom.sculpture_type.value }}
        <summary>Care Instructions</summary>
        {{ product.metafields.custom.care_guide }}
        {{ product.metafields.custom.craftsperson_bio }}
      `,
    },
  ]);
  if (liquidSlots.length < 2) {
    throw new Error("theme-look: liquid metafield extract failed");
  }

  const filenames = sectionFilenamesFromTemplate(
    JSON.stringify({
      sections: { main: { type: "main-product" } },
      order: ["main"],
    }),
  );
  if (!filenames.includes("sections/main-product.liquid")) {
    throw new Error("theme-look: section filename extract failed");
  }
}
