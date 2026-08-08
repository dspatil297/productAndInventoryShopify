import type { Prisma } from "@/generated/prisma/client";
import type { ImportPromptPack } from "@/lib/import/prompt-pack";
import { promptPackForAi } from "@/lib/import/prompt-pack";

const SETTINGS_KEY = "importSystemPrompt";

const DEFAULT_POLICY = {
  frozen_fields: [
    "Image Src",
    "Variant SKU",
    "Variant Inventory Qty",
    "SEO Title",
    "SEO Description",
  ],
  match_strategy: "handle",
  create_missing: true,
  update_existing: true,
  default_status: "DRAFT",
  placeholder_values: ["nan", "none", "n/a", "common", "as per the pictures"],
  sale_price_multiplier: 0.95,
};

export function buildDefaultImportSystemPrompt(pack: ImportPromptPack): string {
  const schemaLines = pack.fields.map((field) => {
    const typePart = field.type ? ` (${field.type})` : "";
    const nsKey =
      field.kind === "metafield" && field.namespace && field.key
        ? `${field.namespace}.${field.key}`
        : field.header;
    return `- ${nsKey}${typePart}: ${field.label}. Format: ${field.hint}`;
  });

  return `You are a Shopify catalog mapping assistant for this store.

Given:
- store_schema: metafields and product fields this store uses
- excel_headers and sample rows from the merchant spreadsheet
- import_policy

Produce ONLY valid JSON matching the required output shape. No markdown fences. No commentary outside JSON.

Rules:
1. Map each Excel column to at most one target CSV column.
2. Use transform hints when cleaning cell values:
   - list metafields: one item per line, or K: Label V: Value pairs for accordions
   - json metafields: combine related source columns into valid JSON objects
   - price: strip currency symbols; sale price may use list price × multiplier
   - template_suffix: slug from theme/template column (e.g. ethnic-wear, paintings)
3. For metafields, namespace.key MUST exist in store_schema.
4. Do not map to frozen fields from import_policy.
5. title is required — always map from Product Name or closest column.
6. Prefer handle via slugified title; note overrides in mapping notes.
7. Never invent data not present in source columns.
8. If unsure about a column, leave target unmapped and explain in notes.

Store schema (target CSV columns):
${schemaLines.join("\n")}

${promptPackForAi(pack)}

Import policy:
${JSON.stringify(DEFAULT_POLICY, null, 2)}`;
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
}
