import type { Prisma } from "@/generated/prisma/client";
import type { ImportPromptPack } from "@/lib/import/prompt-pack";
import { DEFAULT_IMPORT_POLICY } from "@/lib/import/spec/import-policy";
import type { ImportPolicy, StoreSchema } from "@/lib/import/spec/types";

const SETTINGS_KEY = "importSystemPrompt";

export function isLegacySystemPrompt(prompt: string | null | undefined): boolean {
  if (!prompt || !prompt.trim()) {
    return true;
  }
  return (
    prompt.includes("Map each Excel column to at most one target CSV column.") ||
    !prompt.includes("column_map")
  );
}

export function buildDefaultImportSystemPrompt(
  pack: ImportPromptPack,
  schema?: StoreSchema,
  policy: ImportPolicy = DEFAULT_IMPORT_POLICY,
): string {
  const baseFields = pack.fields
    .filter((field) => field.kind === "base")
    .map((field) => `- ${field.header}: ${field.label}`);

  const metafieldLines =
    schema && schema.metafields.length > 0
      ? schema.metafields.map((field) => {
          const hints: string[] = [];
          if (field.parse_hint) {
            hints.push(`parse=${field.parse_hint}`);
          }
          if (field.liquid_hints?.length) {
            hints.push(`theme="${field.liquid_hints[0].slice(0, 90)}"`);
          }
          if (field.sample_values?.length) {
            hints.push(`sample="${field.sample_values[0].slice(0, 90)}"`);
          }
          const suffix = hints.length > 0 ? ` [${hints.join("; ")}]` : "";
          return `- ${field.namespace}.${field.key} (${field.shopify_type}): ${field.name}${suffix}`;
        })
      : pack.fields
          .filter((field) => field.kind === "metafield")
          .map((field) => {
            const nsKey =
              field.namespace && field.key
                ? `${field.namespace}.${field.key}`
                : field.header;
            return `- ${nsKey} (${field.type ?? "unknown"}): ${field.label}. Format: ${field.hint}`;
          });

  return `You are a Shopify catalog mapping assistant for this store.

Given:
- store_schema: product fields and metafields (with theme Liquid hints & sample values)
- excel_headers and sample rows from the merchant spreadsheet
- import_policy

Return ONLY valid JSON matching this exact shape (no markdown fences, no commentary):
{
  "column_map": {
    "<Exact Excel Header>": {
      "target": "title | body_html | handle | template_suffix | variant.price | variant.compare_at_price | variant.sku | tags | metafield | ignore",
      "namespace": "custom (required when target is metafield)",
      "key": "metafield_key (required when target is metafield)",
      "transform": "identity | clean_text | skip_placeholder | slugify | html_paragraphs | lines_to_list | comma_to_list | kv_lines | kv_column | dimensions_block | impact_stats | impact_note | faq_columns | story_maker_json | story_process_json | story_heritage_json | story_styling_json | sale_from_list",
      "transform_params": { "kv_label": "Material", "multiplier": 0.95 },
      "merge_strategy": "replace | merge_kv | merge_text | skip_if_empty"
    }
  },
  "extra_mappings": [
    {
      "source_column": "<Exact Excel Header>",
      "target": "metafield",
      "namespace": "custom",
      "key": "filter_material",
      "transform": "clean_text"
    }
  ],
  "handle_strategy": { "primary": "slugify", "source_column": "<Title Header>", "overrides": {} },
  "template_map": { "painting": "paintings", "ethnic": "ethnic-wear", "jewel": "jewellery", "decor": "sculpture", "sculpture": "sculpture" },
  "notes": ["short mapping notes"]
}

Rules:
1. Keys in column_map MUST match exact Excel header names from the spreadsheet.
2. title is required — map from Product Name, Painting Title, or closest title column.
3. body_html: map description/one-liner column using transform "html_paragraphs".
4. variant.price: map Price/MRP using transform "sale_from_list" with transform_params { "multiplier": ${policy.sale_price_multiplier ?? 0.95} } (sets both price and compare_at_price).
5. Accordion detail columns (Material, Fabric, Color, Jewellery Type, Base Material, Stones, Weight, Finish, Craft Tradition, Tradition, Region, Medium, etc.) -> map each non-empty attribute column to custom.product_details with transform "kv_column", transform_params { "kv_label": "<Display Label>" }, and merge_strategy "merge_kv". Skip empty summary columns like an empty "Product Details" column.
6. Multi-target columns: when a column populates BOTH custom.product_details (via kv_column) AND a collection filter (custom.filter_*), put the primary mapping in column_map and the additional mapping(s) in extra_mappings with source_column.
7. List metafields:
   - Whats Included / Care Instructions (newline or "•" bulleted) -> transform "lines_to_list"
   - custom.filter_occasion (comma-separated values) -> transform "comma_to_list"
   - Dimensions & Scale / Canvas Size -> custom.product_measurements with transform "dimensions_block" (and highlight/note via extra_mappings if applicable)
   - FAQs / FAQ 1..FAQ 6 -> custom.product_faq with transform "faq_columns"
   - Artisan Impact / Artisans Impact -> custom.product_impact_stats with transform "impact_stats", PLUS extra_mappings to custom.product_impact_note with transform "impact_note"
8. Story JSON metafields (namespace "custom"):
   - The Maker / The Weaver / The Curation Story / Artist -> custom.product_maker_story with "story_maker_json"
   - How its Made / The Making / How It's Made -> custom.product_process_story with "story_process_json"
   - Artistry Behind / THE FABRIC / The Tradition / Understanding the Painting -> custom.product_heritage_story with "story_heritage_json"
   - Application and Styling -> custom.pdp_styling_story with "story_styling_json"
9. For metafields, namespace.key MUST exist in store_schema below. Do not map to frozen fields (${policy.frozen_fields.slice(0, 6).join(", ")}).
10. Never invent data not present in source columns; ignore unmapped shipping/meta columns.

Core product fields:
${baseFields.join("\n")}

Store metafield schema:
${metafieldLines.join("\n")}

Import policy:
${JSON.stringify(policy, null, 2)}`;
}

export function readImportSystemPromptFromSettings(
  settings: Prisma.JsonValue | null | undefined,
): string | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return null;
  }
  const value = (settings as Record<string, unknown>)[SETTINGS_KEY];
  return typeof value === "string" && value.trim() ? value : null;
}

export function mergeSystemPromptIntoSettings(
  settings: Record<string, unknown>,
  systemPrompt: string,
): Record<string, unknown> {
  return { ...settings, [SETTINGS_KEY]: systemPrompt };
}

/** ponytail: assert-based self-check */
export function runSystemPromptSelfCheck(): void {
  const pack = {
    version: "test",
    builtAt: new Date().toISOString(),
    headers: ["title", "custom.color"],
    fields: [
      { header: "title", kind: "base" as const, label: "Title", hint: "product title" },
      {
        header: "custom.color",
        kind: "metafield" as const,
        namespace: "custom",
        key: "color",
        type: "single_line_text_field",
        label: "Color",
        hint: "plain text",
      },
    ],
  };
  const prompt = buildDefaultImportSystemPrompt(pack);
  if (!prompt.includes("custom.color")) {
    throw new Error("system prompt missing metafield");
  }
  if (!prompt.includes("Shopify catalog mapping assistant")) {
    throw new Error("system prompt missing role");
  }
  if (!prompt.includes("column_map")) {
    throw new Error("system prompt missing column_map contract");
  }
}
