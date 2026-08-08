import { z } from "zod";
import type { ImportPromptPack } from "@/lib/import/prompt-pack";
import { AiImportConfigError, AiImportMapError } from "@/lib/import/ai-map-columns";

const BATCH_SIZE = 5;
const MAX_ROWS = 120;

const transformBatchSchema = z.object({
  rows: z.array(z.record(z.string(), z.string())),
});

export interface ImportSynthesisRow {
  source: Record<string, string>;
  partial: Record<string, string>;
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

function fieldRulesForPack(pack: ImportPromptPack): string {
  return pack.fields
    .map(
      (field) =>
        `- ${field.header} (${field.kind}${field.type ? ` / ${field.type}` : ""}): ${field.label}. ${field.hint}`,
    )
    .join("\n");
}

function buildRowSchema(headers: string[]) {
  return {
    type: "object" as const,
    additionalProperties: false,
    properties: Object.fromEntries(
      headers.map((header) => [header, { type: "string" }]),
    ),
    required: headers,
  };
}

async function synthesizeBatchWithAi(
  inputs: ImportSynthesisRow[],
  pack: ImportPromptPack,
): Promise<Record<string, string>[]> {
  const config = getAiImportConfig();
  const headers = pack.headers;

  const payloadRows = inputs.map((input) => ({
    source_columns: input.source,
    mapped_so_far: input.partial,
  }));

  const userContent = [
    "Build complete Shopify product import rows from messy spreadsheet data.",
    "",
    "Target store CSV schema:",
    fieldRulesForPack(pack),
    "",
    "Rules:",
    "- Use ANY source column that fits a target — many source columns may merge into one json metafield.",
    "- json metafields: combine related source fields into JSON arrays of {k,v} or {q,a} objects, or valid JSON objects. Example: Material, Finish, Weight -> product_details KV JSON.",
    "- FAQ source columns -> faq json with q/a pairs.",
    "- description: use Product Description and related prose; preserve HTML if present.",
    "- list.* metafields: JSON array string of strings.",
    "- template_suffix: slug from theme/template column if present.",
    "- price / compare_at_price: numbers only, strip currency symbols.",
    "- Prefer mapped_so_far values when already correct; fill empty targets from source_columns.",
    "- Never invent facts not present in source_columns.",
    "- Return exactly one output row per input, same order, all target keys as strings.",
    "",
    `Input rows JSON: ${JSON.stringify(payloadRows)}`,
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
            "You synthesize multi-column spreadsheet rows into a fixed Shopify import schema for a multi-tenant app. Output only JSON matching the schema.",
        },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "synthesized_rows",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              rows: {
                type: "array",
                items: buildRowSchema(headers),
              },
            },
            required: ["rows"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new AiImportMapError(
      `AI row synthesis failed (${response.status}): ${body.slice(0, 200)}`,
    );
  }

  const responsePayload: unknown = await response.json();
  const content = extractMessageContent(responsePayload);
  if (!content) {
    throw new AiImportMapError("AI row synthesis returned empty content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AiImportMapError("AI row synthesis returned invalid JSON");
  }

  const validated = transformBatchSchema.safeParse(parsed);
  if (!validated.success) {
    throw new AiImportMapError(
      `AI row synthesis schema invalid: ${validated.error.message}`,
    );
  }

  if (validated.data.rows.length !== inputs.length) {
    throw new AiImportMapError("AI row synthesis changed row count");
  }

  return validated.data.rows.map((row, index) => {
    const normalized: Record<string, string> = {};
    for (const header of headers) {
      const synthesized = row[header]?.trim() ?? "";
      const fallback = inputs[index].partial[header]?.trim() ?? "";
      normalized[header] = synthesized || fallback;
    }
    return normalized;
  });
}

export async function synthesizeImportRowsWithAi(
  inputs: ImportSynthesisRow[],
  pack: ImportPromptPack,
): Promise<Record<string, string>[]> {
  if (inputs.length === 0) {
    return [];
  }
  if (inputs.length > MAX_ROWS) {
    throw new AiImportMapError(
      `Too many rows (${inputs.length}). Split file to ${MAX_ROWS} rows or fewer.`,
    );
  }

  const output: Record<string, string>[] = [];
  for (let index = 0; index < inputs.length; index += BATCH_SIZE) {
    const batch = inputs.slice(index, index + BATCH_SIZE);
    const synthesized = await synthesizeBatchWithAi(batch, pack);
    output.push(...synthesized);
  }
  return output;
}

/** @deprecated use synthesizeImportRowsWithAi */
export async function transformImportRowsWithAi(
  rows: Record<string, string>[],
  pack: ImportPromptPack,
): Promise<Record<string, string>[]> {
  return synthesizeImportRowsWithAi(
    rows.map((partial) => ({ source: { ...partial }, partial })),
    pack,
  );
}
