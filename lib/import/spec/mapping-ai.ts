import { z } from "zod";
import { sampleExcelRows, type ExcelTable } from "@/lib/import/excel-parse";
import { AiImportConfigError, AiImportMapError } from "@/lib/import/ai-map-columns";
import type {
  ImportPolicy,
  MappingConfig,
  StoreSchema,
  TransformId,
} from "@/lib/import/spec/types";

const transformIds = [
  "identity",
  "clean_text",
  "skip_placeholder",
  "slugify",
  "html_paragraphs",
  "lines_to_list",
  "comma_to_list",
  "kv_lines",
  "impact_stats",
  "impact_note",
  "sale_from_list",
  "faq_columns",
  "story_maker_json",
  "story_process_json",
  "story_heritage_json",
  "story_styling_json",
  "dimensions_block",
  "kv_column",
] as const;

const columnMappingSchema = z.object({
  target: z.enum([
    "title",
    "body_html",
    "handle",
    "template_suffix",
    "variant.price",
    "variant.compare_at_price",
    "variant.sku",
    "tags",
    "metafield",
    "ignore",
  ]),
  namespace: z.string().optional(),
  key: z.string().optional(),
  transform: z.enum(transformIds),
  transform_params: z.record(z.string(), z.unknown()).optional(),
  merge_strategy: z
    .enum(["replace", "merge_kv", "merge_text", "skip_if_empty"])
    .optional(),
});

const mappingConfigSchema = z.object({
  column_map: z.record(z.string(), columnMappingSchema),
  handle_strategy: z
    .object({
      primary: z.literal("slugify"),
      source_column: z.string(),
      overrides: z.record(z.string(), z.string()),
    })
    .optional(),
  template_map: z.record(z.string(), z.string()).optional(),
  notes: z.array(z.string()).optional(),
});

function getAiImportConfig(): {
  apiKey: string;
  model: string;
  baseUrl: string;
} {
  const isOpenRouter = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const apiKey =
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.AI_IMPORT_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    "";
  if (!apiKey) {
    throw new AiImportConfigError(
      "OPENROUTER_API_KEY (or AI_IMPORT_API_KEY / OPENAI_API_KEY) is not set",
    );
  }

  const defaultBaseUrl = isOpenRouter
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";

  const defaultModel = isOpenRouter ? "openai/gpt-4o-mini" : "gpt-4o-mini";

  return {
    apiKey,
    model: process.env.AI_IMPORT_MODEL?.trim() || defaultModel,
    baseUrl: process.env.AI_IMPORT_BASE_URL?.trim() || defaultBaseUrl,
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

function storyTransformForKey(key: string): TransformId {
  const lowered = key.toLowerCase();
  if (/maker|weaver|artist|curator|weaver/.test(lowered)) {
    return "story_maker_json";
  }
  if (/process|making|craft/.test(lowered)) {
    return "story_process_json";
  }
  if (/styling|occasion/.test(lowered)) {
    return "story_styling_json";
  }
  if (/heritage|fabric|tradition|culture/.test(lowered)) {
    return "story_heritage_json";
  }
  return "story_maker_json";
}

export function heuristicMappingConfig(
  table: ExcelTable,
  schema: StoreSchema,
): MappingConfig {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const sourceByNorm = new Map(
    table.headers.map((header) => [normalize(header), header]),
  );

  const column_map: MappingConfig["column_map"] = {};
  const aliases: Record<string, string[]> = {
    title: [
      "product name",
      "painting title",
      "product title",
      "name",
      "title",
      "item",
    ],
    body_html: [
      "description",
      "product description",
      "short description",
      "one liner",
      "one-liner",
      "body",
    ],
    "variant.price": ["price", "mrp", "list price", "sale price"],
    "variant.sku": ["sku", "sku code", "sku_code"],
    template_suffix: ["template", "theme", "category", "page template"],
  };

  const mapSource = (candidates: string[]): string | null => {
    for (const candidate of candidates) {
      const match = sourceByNorm.get(normalize(candidate));
      if (match) {
        return match;
      }
    }
    return null;
  };

  const matchFieldHeader = (field: StoreSchema["metafields"][0]): string | null => {
    const labels = [
      field.name,
      field.key,
      field.key.replace(/_/g, " "),
      `${field.namespace}.${field.key}`,
      ...field.aliases,
    ];
    const direct = mapSource(labels);
    if (direct) {
      return direct;
    }
    const fieldNorms = labels.map((label) => normalize(label)).filter(Boolean);
    for (const header of table.headers) {
      if (column_map[header]) {
        continue;
      }
      const headerNorm = normalize(header);
      if (
        fieldNorms.some(
          (candidate) =>
            headerNorm === candidate ||
            headerNorm.includes(candidate) ||
            candidate.includes(headerNorm),
        )
      ) {
        return header;
      }
    }
    return null;
  };

  const titleSource =
    mapSource(aliases.title) ??
    table.headers.find((header) => {
      const normalized = normalize(header);
      return (
        normalized.includes("title") ||
        normalized.endsWith(" name") ||
        normalized === "product"
      );
    }) ??
    null;
  if (titleSource) {
    column_map[titleSource] = { target: "title", transform: "clean_text" };
  }

  const bodySource = mapSource(aliases.body_html);
  if (bodySource) {
    column_map[bodySource] = { target: "body_html", transform: "html_paragraphs" };
  }

  const priceSource = mapSource(aliases["variant.price"]);
  if (priceSource) {
    column_map[priceSource] = {
      target: "variant.price",
      transform: "sale_from_list",
      transform_params: { multiplier: 0.95 },
    };
  }

  const skuSource = mapSource(aliases["variant.sku"]);
  if (skuSource && !column_map[skuSource]) {
    column_map[skuSource] = {
      target: "variant.sku",
      transform: "clean_text",
    };
  }

  const templateSource = mapSource(aliases.template_suffix);
  if (templateSource) {
    column_map[templateSource] = {
      target: "template_suffix",
      transform: "slugify",
    };
  }

  for (const field of schema.metafields) {
    const source = matchFieldHeader(field);
    if (!source || column_map[source]) {
      continue;
    }
    let transform: TransformId = "clean_text";
    if (field.value_kind === "json") {
      transform = storyTransformForKey(field.key);
    } else if (field.parse_hint === "kv_lines") {
      transform = "kv_lines";
    } else if (field.parse_hint === "faq_pipe") {
      transform = "faq_columns";
    } else if (field.parse_hint === "impact_stats") {
      transform = "impact_stats";
    } else if (field.value_kind === "string_list") {
      transform = "lines_to_list";
    } else if (field.parse_hint === "paragraphs") {
      transform = "html_paragraphs";
    }
    column_map[source] = {
      target: "metafield",
      namespace: field.namespace,
      key: field.key,
      transform,
      merge_strategy: field.parse_hint === "kv_lines" ? "merge_kv" : "replace",
    };
  }

  return {
    excel: { header_row: 1 },
    column_map,
    handle_overrides: {},
    template_map: {
      painting: "paintings",
      ethnic: "ethnic-wear",
      jewel: "jewellery",
      decor: "sculpture",
      sculpture: "sculpture",
    },
    handle_strategy: {
      primary: "slugify",
      source_column: titleSource ?? "",
      overrides: {},
    },
    notes: ["heuristic mapping"],
  };
}

const AI_MAPPING_TIMEOUT_MS = 12_000;

export async function suggestMappingConfigWithAi(input: {
  table: ExcelTable;
  schema: StoreSchema;
  policy: ImportPolicy;
  systemPrompt: string;
  existing?: MappingConfig;
}): Promise<MappingConfig> {
  const config = getAiImportConfig();
  const samples = sampleExcelRows(input.table, 3);
  const userContent = [
    `Excel headers: ${input.table.headers.join(", ")}`,
    `Sample rows: ${JSON.stringify(samples)}`,
    `Store schema: ${JSON.stringify(input.schema.metafields)}`,
    `Import policy: ${JSON.stringify(input.policy)}`,
    input.existing
      ? `Existing mapping: ${JSON.stringify(input.existing.column_map)}`
      : "",
    "Return column_map keyed by exact Excel header names.",
  ].join("\n");

  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(AI_MAPPING_TIMEOUT_MS),
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
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

  // Normalize common LLM output structures
  if (parsed && typeof parsed === "object") {
    const raw = parsed as Record<string, unknown>;
    if (Array.isArray(raw.column_map)) {
      const map: Record<string, unknown> = {};
      for (const item of raw.column_map) {
        if (item && typeof item === "object" && "source" in item && typeof (item as Record<string, unknown>).source === "string") {
          const { source, ...rest } = item as Record<string, unknown>;
          map[source as string] = rest;
        }
      }
      raw.column_map = map;
    } else if (Array.isArray(raw.mappings)) {
      const map: Record<string, unknown> = {};
      for (const item of raw.mappings) {
        if (item && typeof item === "object" && "source" in item && typeof (item as Record<string, unknown>).source === "string") {
          const { source, ...rest } = item as Record<string, unknown>;
          map[source as string] = rest;
        }
      }
      raw.column_map = map;
    } else if (!raw.column_map) {
      // Check if the root object itself is the column_map
      const headerSet = new Set(input.table.headers);
      const isDirectMap = Object.keys(raw).some((key) => headerSet.has(key));
      if (isDirectMap) {
        raw.column_map = { ...raw };
      }
    }

    if (
      raw.column_map &&
      typeof raw.column_map === "object" &&
      !Array.isArray(raw.column_map)
    ) {
      const cleaned: Record<string, unknown> = {};
      for (const [col, val] of Object.entries(
        raw.column_map as Record<string, unknown>,
      )) {
        if (val && typeof val === "object" && !Array.isArray(val)) {
          cleaned[col] = val;
        } else if (typeof val === "string" && val.trim()) {
          cleaned[col] = { target: val.trim(), transform: "identity" };
        }
      }
      raw.column_map = cleaned;
    }
  }

  const validated = mappingConfigSchema.safeParse(parsed);
  if (!validated.success) {
    throw new AiImportMapError(
      `AI mapping schema invalid: ${validated.error.message}`,
    );
  }

  const titleMapped = Object.values(validated.data.column_map).some(
    (entry) => entry.target === "title",
  );
  if (!titleMapped) {
    throw new AiImportMapError("AI mapping missing title column");
  }

  const headerSet = new Set(input.table.headers);
  for (const sourceKey of Object.keys(validated.data.column_map)) {
    if (!headerSet.has(sourceKey)) {
      throw new AiImportMapError(
        `AI mapped column "${sourceKey}" is not an Excel header`,
      );
    }
  }

  return {
    excel: { header_row: 1 },
    column_map: validated.data.column_map,
    handle_overrides: input.existing?.handle_overrides ?? {},
    template_map: {
      painting: "paintings",
      ethnic: "ethnic-wear",
      jewel: "jewellery",
      decor: "sculpture",
      sculpture: "sculpture",
      ...(validated.data.template_map ?? {}),
    },
    handle_strategy: validated.data.handle_strategy ?? {
      primary: "slugify",
      source_column:
        Object.entries(validated.data.column_map).find(
          ([, entry]) => entry.target === "title",
        )?.[0] ?? "",
      overrides: {},
    },
    notes: validated.data.notes,
  };
}
