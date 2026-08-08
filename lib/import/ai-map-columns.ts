import { z } from "zod";
import type { ColumnMapping } from "@/lib/import/apply-column-map";
import type { ExcelTable } from "@/lib/import/excel-parse";
import { sampleExcelRows } from "@/lib/import/excel-parse";
import {
  type ImportPromptPack,
  promptPackForAi,
} from "@/lib/import/prompt-pack";

const columnMappingSchema = z.object({
  mappings: z.array(
    z.object({
      target: z.string(),
      source: z.string().nullable(),
    }),
  ),
});

export class AiImportConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiImportConfigError";
  }
}

export class AiImportMapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiImportMapError";
  }
}

function getAiImportConfig(): {
  apiKey: string;
  model: string;
  baseUrl: string;
} {
  const apiKey =
    process.env.AI_IMPORT_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    "";
  if (!apiKey) {
    throw new AiImportConfigError(
      "AI_IMPORT_API_KEY (or OPENAI_API_KEY) is not set",
    );
  }

  return {
    apiKey,
    model: process.env.AI_IMPORT_MODEL?.trim() || "gpt-4o-mini",
    baseUrl:
      process.env.AI_IMPORT_BASE_URL?.trim() ||
      "https://api.openai.com/v1/chat/completions",
  };
}

function buildMappingSchema(targetHeaders: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      mappings: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            target: { type: "string", enum: targetHeaders },
            source: { type: ["string", "null"] },
          },
          required: ["target", "source"],
        },
      },
    },
    required: ["mappings"],
  };
}

export async function mapExcelColumnsWithAi(
  table: ExcelTable,
  pack: ImportPromptPack,
  systemPrompt?: string,
): Promise<ColumnMapping[]> {
  const config = getAiImportConfig();
  const samples = sampleExcelRows(table, 3);
  const targetHeaders = pack.headers;

  const userContent = [
    promptPackForAi(pack),
    "",
    `Source spreadsheet columns: ${table.headers.join(", ")}`,
    `Sample rows (JSON): ${JSON.stringify(samples)}`,
    "",
    "Map each target column to the best matching source column name, or null if no match.",
    "Use exact source column names from the list above.",
    "title is required — always map it if any reasonable source exists.",
    "template_suffix: map spreadsheet theme/template/page-template columns. Use the theme suffix value (e.g. ethnic-wear), not a display label. Empty cells are ok.",
  ].join("\n");

  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            systemPrompt?.trim() ||
            "You map messy spreadsheet columns to a fixed Shopify product import CSV schema. Return only structured JSON via the schema. Never include secrets, tokens, or shop credentials.",
        },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "column_mapping",
          strict: true,
          schema: buildMappingSchema(targetHeaders),
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new AiImportMapError(
      `AI mapping failed (${response.status}): ${body.slice(0, 200)}`,
    );
  }

  const payload: unknown = await response.json();
  const content = extractMessageContent(payload);
  if (!content) {
    throw new AiImportMapError("AI mapping returned empty content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AiImportMapError("AI mapping returned invalid JSON");
  }

  const validated = columnMappingSchema.safeParse(parsed);
  if (!validated.success) {
    throw new AiImportMapError(
      `AI mapping schema invalid: ${validated.error.message}`,
    );
  }

  return normalizeMappings(validated.data.mappings, targetHeaders, table.headers);
}

function extractMessageContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  const content = message?.content;
  return typeof content === "string" ? content : null;
}

function normalizeMappings(
  mappings: ColumnMapping[],
  targetHeaders: string[],
  sourceHeaders: string[],
): ColumnMapping[] {
  const sourceSet = new Set(sourceHeaders);
  const byTarget = new Map<string, ColumnMapping>();

  for (const mapping of mappings) {
    if (!targetHeaders.includes(mapping.target)) {
      continue;
    }
    const source =
      mapping.source && sourceSet.has(mapping.source) ? mapping.source : null;
    byTarget.set(mapping.target, { target: mapping.target, source });
  }

  return targetHeaders.map((target) => {
    return byTarget.get(target) ?? { target, source: null };
  });
}

/** Rule-based fallback for tests / when AI unavailable in self-check only */
export function heuristicColumnMappings(
  table: ExcelTable,
  pack: ImportPromptPack,
): ColumnMapping[] {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const sourceByNorm = new Map(
    table.headers.map((header) => [normalize(header), header]),
  );

  const aliases: Record<string, string[]> = {
    title: ["title", "product name", "name", "product title", "item"],
    handle: ["handle", "slug", "url"],
    description: ["description", "body", "details", "product description"],
    product_type: ["product type", "type", "category", "sculpture type"],
    vendor: ["vendor", "brand", "manufacturer"],
    status: ["status", "published"],
    price: ["price", "variant price", "sale price", "mrp"],
    compare_at_price: ["compare at price", "compare price", "msrp", "rrp"],
    sku: ["sku", "variant sku", "item code"],
    inventory_qty: ["inventory qty", "quantity", "stock", "qty"],
    track_inventory: ["track inventory", "tracked"],
    template_suffix: [
      "template",
      "theme",
      "template suffix",
      "product template",
      "page template",
      "theme template",
      "template name",
    ],
  };

  return pack.headers.map((target) => {
    const candidates = aliases[target] ?? [target.replace(/_/g, " ")];

    const field = pack.fields.find((entry) => entry.header === target);
    if (field?.kind === "metafield") {
      const labelCandidates = [
        field.label,
        field.key,
        field.header.replace(".", " "),
        field.header,
      ].filter((candidate): candidate is string => Boolean(candidate));
      for (const candidate of labelCandidates) {
        const match = sourceByNorm.get(normalize(candidate));
        if (match) {
          return { target, source: match };
        }
      }
      for (const header of table.headers) {
        const headerNorm = normalize(header);
        const labelNorm = normalize(field.label);
        const keyNorm = field.key ? normalize(field.key.replace(/_/g, " ")) : "";
        if (
          (labelNorm &&
            (headerNorm.includes(labelNorm) || labelNorm.includes(headerNorm))) ||
          (keyNorm &&
            (headerNorm.includes(keyNorm) || keyNorm.includes(headerNorm)))
        ) {
          return { target, source: header };
        }
      }
    }

    for (const candidate of candidates) {
      const match = sourceByNorm.get(normalize(candidate));
      if (match) {
        return { target, source: match };
      }
    }
    for (const header of table.headers) {
      if (normalize(header).includes(normalize(target.replace(/_/g, " ")))) {
        return { target, source: header };
      }
    }
    return { target, source: null };
  });
}

/** ponytail: assert-based self-check — heuristic only, no API */
export function runAiMapHeuristicSelfCheck(): void {
  const table = {
    sheetName: "Sheet1",
    headers: ["Product Name", "Sale Price"],
    rows: [["Coat", "99"]],
  };
  const pack = {
    version: "test",
    builtAt: new Date().toISOString(),
    headers: ["title", "price"],
    fields: [],
  };
  const mappings = heuristicColumnMappings(table, pack);
  const titleMap = mappings.find((mapping) => mapping.target === "title");
  if (titleMap?.source !== "Product Name") {
    throw new Error("heuristic title map failed");
  }
}
