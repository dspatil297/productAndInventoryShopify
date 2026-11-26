import { z } from "zod";
import { sampleExcelRows, type ExcelTable } from "@/lib/import/excel-parse";
import { AiImportConfigError, AiImportMapError } from "@/lib/import/ai-map-columns";
import { isLegacySystemPrompt } from "@/lib/import/system-prompt";
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

const extraMappingSchema = columnMappingSchema.extend({
  source_column: z.string(),
});

const mappingConfigSchema = z.object({
  column_map: z.record(z.string(), columnMappingSchema),
  extra_mappings: z.array(extraMappingSchema).optional(),
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

  const configuredUrl = process.env.AI_IMPORT_BASE_URL?.trim();
  const isOpenRouter =
    Boolean(process.env.OPENROUTER_API_KEY?.trim()) ||
    apiKey.startsWith("sk-or-") ||
    Boolean(configuredUrl?.includes("openrouter.ai"));

  const baseUrl =
    configuredUrl ||
    (isOpenRouter
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions");

  let model =
    process.env.AI_IMPORT_MODEL?.trim() ||
    (isOpenRouter ? "openai/gpt-4o-mini" : "gpt-4o-mini");

  // ponytail: OpenRouter requires provider/model; .env.example defaults to bare gpt-4o-mini
  if (isOpenRouter && !model.includes("/") && /^(gpt-|o[134]-|chatgpt-)/.test(model)) {
    model = `openai/${model}`;
  }

  return { apiKey, model, baseUrl };
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
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    const text = content
      .map((part) =>
        part && typeof part === "object" && "text" in part
          ? String((part as { text?: unknown }).text ?? "")
          : "",
      )
      .join("")
      .trim();
    return text || null;
  }
  return null;
}

function parseAiJsonResponse(content: string): unknown {
  const stripped = content
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1));
    }
    throw new AiImportMapError("AI mapping returned invalid JSON");
  }
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
    template_suffix: ["template", "theme", "template suffix", "product template", "page template"],
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
      if (headerNorm.length < 4) {
        continue;
      }
      if (
        fieldNorms.some(
          (candidate) =>
            candidate.length >= 4 &&
            (headerNorm === candidate ||
              headerNorm.includes(candidate) ||
              candidate.includes(headerNorm)),
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

const AI_MAPPING_TIMEOUT_MS = 28_000;

const MAPPING_JSON_CONTRACT = `Return ONLY valid JSON:
{
  "column_map": { "<Exact Excel Header>": { "target": "title|body_html|handle|template_suffix|variant.price|variant.compare_at_price|variant.sku|tags|metafield|ignore", "namespace": "custom", "key": "...", "transform": "clean_text|html_paragraphs|sale_from_list|kv_column|kv_lines|dimensions_block|lines_to_list|comma_to_list|impact_stats|impact_note|faq_columns|story_maker_json|story_process_json|story_heritage_json|story_styling_json|slugify", "transform_params": {}, "merge_strategy": "replace|merge_kv|merge_text|skip_if_empty" } },
  "extra_mappings": [{ "source_column": "<Exact Excel Header>", "target": "metafield", "namespace": "custom", "key": "...", "transform": "..." }],
  "handle_strategy": { "primary": "slugify", "source_column": "<Title Header>", "overrides": {} },
  "template_map": { "painting": "paintings", "ethnic": "ethnic-wear", "jewel": "jewellery", "decor": "sculpture", "sculpture": "sculpture" },
  "notes": []
}`;

function inferMetafieldTransform(
  schema: StoreSchema,
  namespace: string,
  key: string,
  sourceColumn: string,
  samples: Array<Record<string, string>>,
): {
  transform: TransformId;
  transform_params?: Record<string, unknown>;
  merge_strategy?: "replace" | "merge_kv" | "merge_text" | "skip_if_empty";
} {
  const field = schema.metafields.find(
    (item) => item.namespace === namespace && item.key === key,
  );
  const loweredKey = key.toLowerCase();

  if (field?.value_kind === "json" || loweredKey.includes("story")) {
    return { transform: storyTransformForKey(key) };
  }
  if (loweredKey === "product_impact_note") {
    return { transform: "impact_note" };
  }
  if (field?.parse_hint === "impact_stats" || loweredKey.includes("impact_stats")) {
    return { transform: "impact_stats" };
  }
  if (field?.parse_hint === "faq_pipe" || loweredKey.includes("faq")) {
    return { transform: "faq_columns" };
  }
  if (loweredKey === "product_measurements") {
    return { transform: "dimensions_block", merge_strategy: "merge_kv" };
  }
  if (loweredKey === "product_measurement_highlight") {
    return { transform: "dimensions_block", transform_params: { part: "highlight" } };
  }
  if (loweredKey === "product_measurement_note") {
    return { transform: "dimensions_block", transform_params: { part: "note" } };
  }
  if (field?.parse_hint === "kv_lines" || loweredKey === "product_details") {
    const sampleValues = samples
      .map((row) => String(row[sourceColumn] ?? "").trim())
      .filter(Boolean);
    const looksMultiKv = sampleValues.some(
      (val) => /^K:\s*.+\s+V:\s*.+/im.test(val) || (val.includes("\n") && /^[^:]{1,60}:/m.test(val)),
    );
    if (looksMultiKv) {
      return { transform: "kv_lines", merge_strategy: "merge_kv" };
    }
    return {
      transform: "kv_column",
      transform_params: { kv_label: sourceColumn },
      merge_strategy: "merge_kv",
    };
  }
  if (field?.shopify_type === "list.single_line_text_field" || field?.value_kind === "string_list") {
    if (loweredKey.startsWith("filter_")) {
      return { transform: "comma_to_list" };
    }
    return { transform: "lines_to_list" };
  }
  return { transform: "clean_text" };
}

export async function suggestMappingConfigWithAi(input: {
  table: ExcelTable;
  schema: StoreSchema;
  policy: ImportPolicy;
  systemPrompt: string;
  existing?: MappingConfig;
}): Promise<MappingConfig> {
  const config = getAiImportConfig();
  const samples = sampleExcelRows(input.table, 3);
  const schemaSummary = input.schema.metafields.map((field) => ({
    namespace: field.namespace,
    key: field.key,
    name: field.name,
    shopify_type: field.shopify_type,
    parse_hint: field.parse_hint,
    in_theme: field.in_theme,
    ...(field.liquid_hints?.length
      ? { liquid_hints: field.liquid_hints.slice(0, 1).map((h) => h.slice(0, 100)) }
      : {}),
    ...(field.sample_values?.length
      ? { sample_values: field.sample_values.slice(0, 1).map((v) => v.slice(0, 100)) }
      : {}),
  }));
  const systemMessage = isLegacySystemPrompt(input.systemPrompt)
    ? `${input.systemPrompt}\n\n${MAPPING_JSON_CONTRACT}`
    : input.systemPrompt;

  const userContent = [
    `Excel headers: ${JSON.stringify(input.table.headers)}`,
    `Sample rows: ${JSON.stringify(samples)}`,
    `Store schema: ${JSON.stringify(schemaSummary)}`,
    `Import policy: ${JSON.stringify(input.policy)}`,
    input.existing
      ? `Existing mapping: ${JSON.stringify(input.existing.column_map)}`
      : "",
    "Map EVERY non-empty relevant Excel column to core fields or store metafields.",
    "Skip columns whose sample values are all empty (such as an empty 'Product Details' column) and instead map each individual attribute column (Material, Fabric, Color, Base Material, Stones, Weight, Finish, Tradition, Region, Medium, etc.) to custom.product_details with transform='kv_column', transform_params={\"kv_label\":\"<Label>\"}, merge_strategy='merge_kv'.",
    "When one Excel column populates both custom.product_details and a custom.filter_* metafield (or Artisan Impact populates both product_impact_stats and product_impact_note), put the primary mapping in column_map and the extra one(s) in extra_mappings with source_column.",
    "Use exact transforms: kv_column, kv_lines, dimensions_block, lines_to_list, comma_to_list, impact_stats, impact_note, faq_columns, story_maker_json, story_process_json, story_heritage_json, story_styling_json, sale_from_list, html_paragraphs, clean_text.",
    "Return JSON with column_map keyed by exact Excel header names.",
  ]
    .filter(Boolean)
    .join("\n");

  const requestBody = (withJsonFormat: boolean) =>
    JSON.stringify({
      model: config.model,
      temperature: 0,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userContent },
      ],
      ...(withJsonFormat ? { response_format: { type: "json_object" } } : {}),
    });

  let response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(AI_MAPPING_TIMEOUT_MS),
    body: requestBody(true),
  });

  if (response.status === 400) {
    const errText = await response.text();
    if (/response_format|json_object/i.test(errText)) {
      response = await fetch(config.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(AI_MAPPING_TIMEOUT_MS),
        body: requestBody(false),
      });
    } else {
      throw new AiImportMapError(`AI mapping failed (400): ${errText.slice(0, 200)}`);
    }
  }

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
    parsed = parseAiJsonResponse(content);
  } catch {
    throw new AiImportMapError("AI mapping returned invalid JSON");
  }

  const VALID_TARGETS = new Set([
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
  ]);

  const TARGET_ALIASES: Record<string, string> = {
    description: "body_html",
    body: "body_html",
    price: "variant.price",
    compare_at_price: "variant.compare_at_price",
    sku: "variant.sku",
    template: "template_suffix",
  };

  const VALID_TRANSFORMS = new Set<string>(transformIds);
  const VALID_MERGE_STRATEGIES = new Set([
    "replace",
    "merge_kv",
    "merge_text",
    "skip_if_empty",
  ]);

  function normalizeMappingEntry(val: unknown): Record<string, unknown> | null {
    if (typeof val === "string" && val.trim()) {
      const mapped = TARGET_ALIASES[val.trim()] ?? val.trim();
      return {
        target: VALID_TARGETS.has(mapped) ? mapped : "ignore",
        transform: "identity",
      };
    }
    if (!val || typeof val !== "object" || Array.isArray(val)) {
      return null;
    }
    const entry = { ...(val as Record<string, unknown>) };
    if (typeof entry.target === "string") {
      const mapped = TARGET_ALIASES[entry.target.trim()] ?? entry.target.trim();
      if (mapped.includes(".") && !mapped.startsWith("variant.")) {
        const [ns, ...rest] = mapped.split(".");
        entry.target = "metafield";
        entry.namespace = entry.namespace ?? ns;
        entry.key = entry.key ?? rest.join(".");
      } else if (VALID_TARGETS.has(mapped)) {
        entry.target = mapped;
      } else if (
        typeof entry.namespace === "string" &&
        typeof entry.key === "string"
      ) {
        entry.target = "metafield";
      } else {
        entry.target = "ignore";
      }
    } else {
      entry.target =
        typeof entry.namespace === "string" && typeof entry.key === "string"
          ? "metafield"
          : "ignore";
    }

    if (
      typeof entry.transform !== "string" ||
      !VALID_TRANSFORMS.has(entry.transform)
    ) {
      entry.transform = "identity";
    }
    if (
      typeof entry.merge_strategy !== "string" ||
      !VALID_MERGE_STRATEGIES.has(entry.merge_strategy)
    ) {
      delete entry.merge_strategy;
    }
    return entry;
  }

  // Normalize common LLM output structures
  if (parsed && typeof parsed === "object") {
    const raw = parsed as Record<string, unknown>;
    if (Array.isArray(raw.column_map)) {
      const map: Record<string, unknown> = {};
      for (const item of raw.column_map) {
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          const sourceKey =
            (typeof obj.source === "string" && obj.source) ||
            (typeof obj.column === "string" && obj.column) ||
            (typeof obj.header === "string" && obj.header) ||
            (typeof obj.source_column === "string" && obj.source_column) ||
            "";
          if (sourceKey) {
            const { source: _s, column: _c, header: _h, source_column: _sc, ...rest } = obj;
            void _s;
            void _c;
            void _h;
            void _sc;
            map[sourceKey] = rest;
          }
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
        const entry = normalizeMappingEntry(val);
        if (entry) {
          cleaned[col] = entry;
        }
      }
      raw.column_map = cleaned;
    }

    if (Array.isArray(raw.extra_mappings)) {
      raw.extra_mappings = raw.extra_mappings
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const obj = item as Record<string, unknown>;
          if (typeof obj.source_column !== "string" || !obj.source_column) {
            return null;
          }
          const normalized = normalizeMappingEntry(obj);
          return normalized
            ? { ...normalized, source_column: obj.source_column }
            : null;
        })
        .filter(Boolean);
    } else {
      delete raw.extra_mappings;
    }

    if (
      raw.handle_strategy &&
      (typeof raw.handle_strategy !== "object" ||
        (raw.handle_strategy as Record<string, unknown>).primary !== "slugify" ||
        typeof (raw.handle_strategy as Record<string, unknown>).source_column !== "string")
    ) {
      delete raw.handle_strategy;
    }
    if (
      raw.template_map &&
      (typeof raw.template_map !== "object" || Array.isArray(raw.template_map))
    ) {
      delete raw.template_map;
    }
    if (raw.notes && !Array.isArray(raw.notes)) {
      delete raw.notes;
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
  const normalizeHeader = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const headerByNorm = new Map(
    input.table.headers.map((h) => [normalizeHeader(h), h]),
  );

  const resolvedColumnMap: MappingConfig["column_map"] = {};
  for (const [rawKey, entry] of Object.entries(validated.data.column_map)) {
    const sourceKey = headerSet.has(rawKey)
      ? rawKey
      : headerByNorm.get(normalizeHeader(rawKey));
    if (!sourceKey || entry.target === "ignore") {
      continue;
    }
    if (
      entry.target === "metafield" &&
      entry.namespace &&
      entry.key &&
      (entry.transform === "identity" || entry.transform === "clean_text")
    ) {
      const inferred = inferMetafieldTransform(
        input.schema,
        entry.namespace,
        entry.key,
        sourceKey,
        samples,
      );
      resolvedColumnMap[sourceKey] = {
        ...entry,
        transform: inferred.transform,
        transform_params: entry.transform_params ?? inferred.transform_params,
        merge_strategy: entry.merge_strategy ?? inferred.merge_strategy,
      };
    } else {
      resolvedColumnMap[sourceKey] = entry;
    }
  }

  const validExtraMappings = (validated.data.extra_mappings ?? [])
    .map((entry) => {
      const sourceKey = headerSet.has(entry.source_column)
        ? entry.source_column
        : headerByNorm.get(normalizeHeader(entry.source_column));
      if (!sourceKey || entry.target === "ignore") {
        return null;
      }
      if (
        entry.target === "metafield" &&
        entry.namespace &&
        entry.key &&
        (entry.transform === "identity" || entry.transform === "clean_text")
      ) {
        const inferred = inferMetafieldTransform(
          input.schema,
          entry.namespace,
          entry.key,
          sourceKey,
          samples,
        );
        return {
          ...entry,
          source_column: sourceKey,
          transform: inferred.transform,
          transform_params: entry.transform_params ?? inferred.transform_params,
          merge_strategy: entry.merge_strategy ?? inferred.merge_strategy,
        };
      }
      return { ...entry, source_column: sourceKey };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return {
    excel: { header_row: 1 },
    column_map: resolvedColumnMap,
    ...(validExtraMappings.length > 0
      ? { extra_mappings: validExtraMappings }
      : {}),
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
        Object.entries(resolvedColumnMap).find(
          ([, entry]) => entry.target === "title",
        )?.[0] ?? "",
      overrides: {},
    },
    notes: validated.data.notes,
  };
}
