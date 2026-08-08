import type { MetafieldDefinitionNode } from "@/types/shopify";
import { isUnsupportedMetafieldType } from "@/lib/metafields/validators";
import type {
  ParseHint,
  StoreMetafieldSchema,
  StoreSchema,
  ValueKind,
} from "@/lib/import/spec/types";

const METAFIELD_REGEX =
  /(?:product|pdp_product)\.metafields\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/g;

function shopifyTypeToValueKind(typeName: string): ValueKind {
  switch (typeName) {
    case "single_line_text_field":
      return "string";
    case "multi_line_text_field":
      return "text";
    case "list.single_line_text_field":
      return "string_list";
    case "json":
      return "json";
    case "file_reference":
      return "file";
    case "number_integer":
      return "integer";
    case "number_decimal":
      return "decimal";
    case "boolean":
      return "boolean";
    default:
      return "string";
  }
}

function inferParseHint(definition: MetafieldDefinitionNode): ParseHint {
  const key = definition.key.toLowerCase();
  const typeName = definition.type.name;

  if (typeName === "json") {
    if (key.includes("story") || key.includes("styling")) {
      return "json_object";
    }
    return "json_object";
  }
  if (typeName === "list.single_line_text_field") {
    if (key.includes("faq")) {
      return "faq_pipe";
    }
    if (key.includes("impact")) {
      return "impact_stats";
    }
    if (
      key.includes("detail") ||
      key.includes("measurement") ||
      key.includes("included")
    ) {
      return "kv_lines";
    }
    return "lines";
  }
  if (typeName === "multi_line_text_field") {
    return "paragraphs";
  }
  return "plain_text";
}

function inferTransform(parseHint: ParseHint, valueKind: ValueKind): string {
  if (valueKind === "json") {
    if (parseHint === "json_object") {
      return "story_maker_json";
    }
    return "identity";
  }
  if (parseHint === "kv_lines") {
    return "kv_lines";
  }
  if (parseHint === "faq_pipe") {
    return "faq_columns";
  }
  if (parseHint === "impact_stats") {
    return "impact_stats";
  }
  if (parseHint === "comma_list") {
    return "comma_to_list";
  }
  if (parseHint === "lines") {
    return "lines_to_list";
  }
  if (parseHint === "paragraphs" || parseHint === "html_body") {
    return "html_paragraphs";
  }
  return "clean_text";
}

export function scanThemeLiquidForMetafields(
  liquidContents: Array<{ filename: string; content: string }>,
): Map<string, { theme_files: string[] }> {
  const found = new Map<string, { theme_files: string[] }>();
  for (const file of liquidContents) {
    for (const match of file.content.matchAll(METAFIELD_REGEX)) {
      const namespace = match[1];
      const key = match[2];
      const id = `${namespace}.${key}`;
      const entry = found.get(id) ?? { theme_files: [] };
      if (!entry.theme_files.includes(file.filename)) {
        entry.theme_files.push(file.filename);
      }
      found.set(id, entry);
    }
  }
  return found;
}

export function buildStoreSchema(input: {
  shop: string;
  definitions: MetafieldDefinitionNode[];
  productTemplates?: string[];
  themeMetafields?: Map<string, { theme_files: string[] }>;
}): StoreSchema {
  const themeMetafields = input.themeMetafields ?? new Map();
  const metafields: StoreMetafieldSchema[] = [];

  for (const definition of input.definitions) {
    if (isUnsupportedMetafieldType(definition.type.name)) {
      continue;
    }
    const id = `${definition.namespace}.${definition.key}`;
    const themeInfo = themeMetafields.get(id);
    const valueKind = shopifyTypeToValueKind(definition.type.name);
    const parseHint = inferParseHint(definition);

    metafields.push({
      namespace: definition.namespace,
      key: definition.key,
      shopify_type: definition.type.name,
      value_kind: valueKind,
      parse_hint: parseHint,
      name: definition.name,
      required_for_storefront: Boolean(themeInfo),
      in_theme: Boolean(themeInfo),
      theme_files: themeInfo?.theme_files ?? [],
      aliases: [],
    });
  }

  for (const [id, themeInfo] of themeMetafields.entries()) {
    if (metafields.some((field) => `${field.namespace}.${field.key}` === id)) {
      continue;
    }
    const [namespace, key] = id.split(".");
    metafields.push({
      namespace,
      key,
      shopify_type: "unknown",
      value_kind: "string",
      parse_hint: "plain_text",
      name: key,
      required_for_storefront: true,
      in_theme: true,
      theme_files: themeInfo.theme_files,
      aliases: [],
    });
  }

  return {
    schema_version: 1,
    shop: input.shop,
    discovered_at: new Date().toISOString(),
    product_templates: input.productTemplates ?? [],
    metafields,
  };
}

export function defaultTransformForField(
  field: StoreMetafieldSchema,
): string {
  return inferTransform(field.parse_hint, field.value_kind);
}
