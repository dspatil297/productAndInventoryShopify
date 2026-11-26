import type { ExcelTable } from "@/lib/import/excel-parse";
import type {
  ColumnMapping,
  ExtraColumnMapping,
  MappingConfig,
} from "@/lib/import/spec/types";

const CORE_ALIASES: Record<string, string[]> = {
  title: [
    "product name",
    "painting title",
    "product title",
    "title",
    "name",
    "item",
  ],
  body_html: [
    "product description",
    "short description",
    "description",
    "one liner",
    "one-liner",
    "body",
  ],
  "variant.price": ["price", "mrp", "list price", "sale price"],
  "variant.sku": ["sku", "sku code", "sku_code"],
  template_suffix: ["template", "theme", "category", "page template"],
};

const PACK_HEADER_TO_TARGET: Record<string, ColumnMapping["target"]> = {
  title: "title",
  handle: "handle",
  description: "body_html",
  price: "variant.price",
  compare_at_price: "variant.compare_at_price",
  sku: "variant.sku",
  template_suffix: "template_suffix",
};

function normalizeHeader(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findExcelColumn(
  table: ExcelTable,
  candidates: string[],
): string | null {
  const byNorm = new Map(
    table.headers.map((header) => [normalizeHeader(header), header]),
  );
  for (const candidate of candidates) {
    const match = byNorm.get(normalizeHeader(candidate));
    if (match) {
      return match;
    }
  }
  for (const header of table.headers) {
    const normalized = normalizeHeader(header);
    for (const candidate of candidates) {
      const normCandidate = normalizeHeader(candidate);
      if (
        normalized === normCandidate ||
        normalized.includes(normCandidate) ||
        normCandidate.includes(normalized)
      ) {
        return header;
      }
    }
  }
  return null;
}

export function detectArthenicTemplate(headers: string[]): string | undefined {
  const normalized = headers.map((header) => normalizeHeader(header));
  if (
    normalized.includes("painting title") ||
    normalized.some((header) => header.includes("sku code"))
  ) {
    return "paintings";
  }
  if (
    normalized.includes("sculpture type") ||
    (normalized.includes("product name") &&
      normalized.some((header) => header.includes("dimensions")))
  ) {
    return "sculpture";
  }
  if (
    normalized.includes("jewellery type") ||
    normalized.includes("base material")
  ) {
    return "jewellery";
  }
  if (normalized.includes("fabric") && normalized.includes("one liner")) {
    return "ethnic-wear";
  }
  return undefined;
}

function metafieldMapping(
  namespace: string,
  key: string,
  transform: ColumnMapping["transform"],
  merge_strategy?: ColumnMapping["merge_strategy"],
  transform_params?: Record<string, unknown>,
): ColumnMapping {
  return {
    target: "metafield",
    namespace,
    key,
    transform,
    merge_strategy,
    transform_params,
  };
}

function kvDetailMapping(label: string): ColumnMapping {
  return metafieldMapping("custom", "product_details", "kv_column", "merge_kv", {
    kv_label: label,
  });
}

function bindColumn(
  table: ExcelTable,
  column_map: MappingConfig["column_map"],
  candidates: string[],
  mapping: ColumnMapping,
  extra_mappings?: ExtraColumnMapping[],
): void {
  const column = findExcelColumn(table, candidates);
  if (!column) {
    return;
  }
  const existing = column_map[column];
  if (
    extra_mappings &&
    existing &&
    (existing.target !== mapping.target ||
      existing.namespace !== mapping.namespace ||
      existing.key !== mapping.key)
  ) {
    extra_mappings.push({ source_column: column, ...mapping });
    return;
  }
  column_map[column] = mapping;
}

function bindDecorProfile(
  table: ExcelTable,
  column_map: MappingConfig["column_map"],
): void {
  bindColumn(table, column_map, CORE_ALIASES.title, {
    target: "title",
    transform: "clean_text",
  });
  bindColumn(table, column_map, CORE_ALIASES["variant.price"], {
    target: "variant.price",
    transform: "sale_from_list",
    transform_params: { multiplier: 0.95 },
  });
  bindColumn(table, column_map, CORE_ALIASES.body_html, {
    target: "body_html",
    transform: "html_paragraphs",
  });

  const detailColumns: Array<[string[], string]> = [
    [["sculpture type"], "Sculpture type"],
    [["craft tradition"], "Craft tradition"],
    [["material"], "Material"],
    [["finish technique"], "Finish technique"],
    [["surface finish"], "Surface finish"],
    [["storage type"], "Storage type"],
    [["weight"], "Weight"],
    [["usage"], "Usage"],
    [["indoor / outdoor", "indoor outdoor"], "Indoor / Outdoor"],
  ];
  for (const [candidates, label] of detailColumns) {
    bindColumn(table, column_map, candidates, kvDetailMapping(label));
  }

  bindColumn(table, column_map, ["dimensions & scale", "dimensions"], {
    ...metafieldMapping("custom", "product_measurements", "dimensions_block"),
  });
  bindColumn(table, column_map, ["whats included"], {
    ...metafieldMapping("custom", "product_whats_included", "lines_to_list"),
  });
  bindColumn(table, column_map, ["artisan impact"], {
    ...metafieldMapping("custom", "product_impact_stats", "impact_stats"),
  });
  bindColumn(table, column_map, ["care instructions"], {
    ...metafieldMapping("custom", "product_care_instructions", "lines_to_list"),
  });
  bindColumn(table, column_map, ["the maker"], {
    ...metafieldMapping("custom", "maker_story", "story_maker_json"),
  });
  bindColumn(table, column_map, ["how its made", "how it's made"], {
    ...metafieldMapping("custom", "process_story", "story_process_json"),
  });
  bindColumn(table, column_map, ["artistry behind"], {
    ...metafieldMapping("custom", "heritage_story", "story_heritage_json"),
  });
  bindColumn(
    table,
    column_map,
    ["application and styling"],
    metafieldMapping("custom", "styling_story", "story_styling_json"),
  );
  bindColumn(table, column_map, ["faqs", "faq"], {
    ...metafieldMapping("custom", "product_faq", "faq_columns"),
  });
}

function bindPaintingsProfile(
  table: ExcelTable,
  column_map: MappingConfig["column_map"],
): void {
  bindColumn(table, column_map, ["painting title", "product title", "title"], {
    target: "title",
    transform: "clean_text",
  });
  bindColumn(table, column_map, ["sku code", "sku"], {
    target: "variant.sku",
    transform: "clean_text",
  });
  bindColumn(table, column_map, CORE_ALIASES["variant.price"], {
    target: "variant.price",
    transform: "sale_from_list",
    transform_params: { multiplier: 0.95 },
  });
  bindColumn(table, column_map, ["short description", "description"], {
    target: "body_html",
    transform: "html_paragraphs",
  });
}

function bindEthnicProfile(
  table: ExcelTable,
  column_map: MappingConfig["column_map"],
): void {
  bindColumn(table, column_map, CORE_ALIASES.title, {
    target: "title",
    transform: "clean_text",
  });
  bindColumn(table, column_map, CORE_ALIASES["variant.price"], {
    target: "variant.price",
    transform: "sale_from_list",
    transform_params: { multiplier: 0.95 },
  });
  bindColumn(table, column_map, ["one liner", "one-liner", "short description", "description"], {
    target: "body_html",
    transform: "html_paragraphs",
  });

  const detailColumns: Array<[string[], string]> = [
    [["outfit type"], "Outfit type"],
    [["fabric"], "Fabric"],
    [["color"], "Color"],
    [["craft technique", "work style"], "Craft technique"],
    [["pattern"], "Pattern"],
    [["fit", "sleeve style"], "Style"],
    [["occasion"], "Occasion"],
    [["origin"], "Origin"],
    [["weight"], "Weight"],
  ];
  for (const [candidates, label] of detailColumns) {
    bindColumn(table, column_map, candidates, kvDetailMapping(label));
  }

  bindColumn(table, column_map, ["whats included", "what's included"], {
    ...metafieldMapping("custom", "product_whats_included", "lines_to_list"),
  });
  bindColumn(table, column_map, ["care instruction", "care instructions"], {
    ...metafieldMapping("custom", "product_care_instructions", "lines_to_list"),
  });
  bindColumn(table, column_map, ["artisan impact"], {
    ...metafieldMapping("custom", "product_impact_stats", "impact_stats"),
  });
  bindColumn(table, column_map, ["the curation story", "the maker", "curation story"], {
    ...metafieldMapping("custom", "product_maker_story", "story_maker_json"),
  });
  bindColumn(table, column_map, ["the tradition", "the heritage", "heritage story"], {
    ...metafieldMapping("custom", "product_heritage_story", "story_heritage_json"),
  });
  bindColumn(table, column_map, ["color"], {
    ...metafieldMapping("custom", "filter_color", "clean_text"),
  });
  bindColumn(table, column_map, ["fabric"], {
    ...metafieldMapping("custom", "filter_fabric", "clean_text"),
  });
  bindColumn(table, column_map, ["occasion"], {
    ...metafieldMapping("custom", "filter_occasion", "comma_to_list"),
  });
}

function bindJewelleryProfile(
  table: ExcelTable,
  column_map: MappingConfig["column_map"],
  extra_mappings: ExtraColumnMapping[],
): void {
  bindColumn(table, column_map, CORE_ALIASES.title, {
    target: "title",
    transform: "clean_text",
  });
  bindColumn(table, column_map, CORE_ALIASES["variant.price"], {
    target: "variant.price",
    transform: "sale_from_list",
    transform_params: { multiplier: 0.95 },
  });
  bindColumn(table, column_map, ["one liner", "one-liner", "description", "short description"], {
    target: "body_html",
    transform: "html_paragraphs",
  });

  const detailColumns: Array<[string[], string]> = [
    [["jewellery type", "jewelry type"], "Jewellery type"],
    [["base material", "material"], "Base material"],
    [["planting", "plating"], "Plating"],
    [["stones", "stone type"], "Stones"],
    [["closure type", "closure"], "Closure"],
    [["craft tradition"], "Craft tradition"],
    [["occasion"], "Occasion"],
    [["weight"], "Weight"],
    [["finish"], "Finish"],
  ];
  for (const [candidates, label] of detailColumns) {
    bindColumn(table, column_map, candidates, kvDetailMapping(label));
  }

  bindColumn(table, column_map, ["whats included", "what's included"], {
    ...metafieldMapping("custom", "product_whats_included", "lines_to_list"),
  });
  bindColumn(table, column_map, ["care instruction", "care instructions"], {
    ...metafieldMapping("custom", "product_care_instructions", "lines_to_list"),
  });
  bindColumn(table, column_map, ["artisan impact"], {
    ...metafieldMapping("custom", "product_impact_stats", "impact_stats"),
  });
  bindColumn(table, column_map, ["artisan impact"], {
    ...metafieldMapping("custom", "product_impact_note", "impact_note"),
  }, extra_mappings);
  bindColumn(table, column_map, ["the curation story", "the maker", "curation story"], {
    ...metafieldMapping("custom", "product_maker_story", "story_maker_json"),
  });
  bindColumn(table, column_map, ["the tradition", "the heritage", "heritage story"], {
    ...metafieldMapping("custom", "product_heritage_story", "story_heritage_json"),
  });
  bindColumn(table, column_map, ["jewellery type", "jewelry type"], {
    ...metafieldMapping("custom", "filter_jewelry_type", "clean_text"),
  }, extra_mappings);
  bindColumn(table, column_map, ["base material", "material"], {
    ...metafieldMapping("custom", "filter_material", "clean_text"),
  }, extra_mappings);
  bindColumn(table, column_map, ["craft tradition"], {
    ...metafieldMapping("custom", "filter_tradition", "clean_text"),
  }, extra_mappings);
  bindColumn(table, column_map, ["occasion"], {
    ...metafieldMapping("custom", "filter_occasion", "comma_to_list"),
  }, extra_mappings);
}

export function applyArthenicColumnProfile(
  table: ExcelTable,
  mapping: MappingConfig,
): MappingConfig {
  const template = detectArthenicTemplate(table.headers);
  if (!template) {
    return mapping;
  }

  const column_map: MappingConfig["column_map"] = { ...mapping.column_map };
  const extra_mappings: ExtraColumnMapping[] = [
    ...(mapping.extra_mappings ?? []),
  ];

  if (template === "sculpture") {
    bindDecorProfile(table, column_map);
  } else if (template === "paintings") {
    bindPaintingsProfile(table, column_map);
  } else if (template === "ethnic-wear") {
    bindEthnicProfile(table, column_map);
  } else if (template === "jewellery") {
    bindJewelleryProfile(table, column_map, extra_mappings);
  }

  return {
    ...mapping,
    column_map,
    ...(extra_mappings.length > 0 ? { extra_mappings } : {}),
    template_map: {
      ...mapping.template_map,
      decor: "sculpture",
      sculpture: "sculpture",
      painting: "paintings",
      paintings: "paintings",
      ethnic: "ethnic-wear",
      jewel: "jewellery",
      jewellery: "jewellery",
    },
    notes: [...(mapping.notes ?? []), `arthenic:${template}`],
  };
}

function remapPackKeysToExcelHeaders(
  table: ExcelTable,
  column_map: MappingConfig["column_map"],
): MappingConfig["column_map"] {
  const headerSet = new Set(table.headers);
  const next: MappingConfig["column_map"] = {};

  for (const [key, mapping] of Object.entries(column_map)) {
    if (headerSet.has(key)) {
      next[key] = mapping;
      continue;
    }

    const packTarget = PACK_HEADER_TO_TARGET[key];
    if (packTarget && packTarget === mapping.target) {
      const aliases = CORE_ALIASES[packTarget] ?? [key];
      const excelColumn = findExcelColumn(table, aliases);
      if (excelColumn && !next[excelColumn]) {
        next[excelColumn] = mapping;
      }
      continue;
    }

    if (mapping.target === "metafield" && mapping.namespace && mapping.key) {
      const metafieldColumn = findExcelColumn(table, [
        `${mapping.namespace}.${mapping.key}`,
        mapping.key,
        mapping.key.replace(/_/g, " "),
      ]);
      if (metafieldColumn && !next[metafieldColumn]) {
        next[metafieldColumn] = mapping;
      }
    }
  }

  return next;
}

function forceCoreColumn(
  table: ExcelTable,
  column_map: MappingConfig["column_map"],
  target: ColumnMapping["target"],
  aliases: string[],
  mapping: ColumnMapping,
): void {
  const column = findExcelColumn(table, aliases);
  if (!column) {
    return;
  }
  for (const [source, entry] of Object.entries(column_map)) {
    if (source === column) {
      continue;
    }
    if (entry.target === target) {
      delete column_map[source];
    }
  }
  column_map[column] = mapping;
}

function stripCoreColumnsFromMetafields(
  table: ExcelTable,
  column_map: MappingConfig["column_map"],
): void {
  const reserved = new Set<string>();
  for (const aliases of Object.values(CORE_ALIASES)) {
    const column = findExcelColumn(table, aliases);
    if (column) {
      reserved.add(column);
    }
  }

  for (const column of reserved) {
    const entry = column_map[column];
    if (entry && entry.target === "metafield") {
      delete column_map[column];
    }
  }
}

export function ensureCoreMappings(
  table: ExcelTable,
  mapping: MappingConfig,
): MappingConfig {
  const column_map = remapPackKeysToExcelHeaders(table, mapping.column_map);

  for (const key of Object.keys(column_map)) {
    if (!table.headers.includes(key)) {
      delete column_map[key];
    }
  }

  stripCoreColumnsFromMetafields(table, column_map);

  forceCoreColumn(table, column_map, "title", CORE_ALIASES.title, {
    target: "title",
    transform: "clean_text",
  });
  forceCoreColumn(table, column_map, "body_html", CORE_ALIASES.body_html, {
    target: "body_html",
    transform: "html_paragraphs",
  });
  forceCoreColumn(
    table,
    column_map,
    "variant.price",
    CORE_ALIASES["variant.price"],
    {
      target: "variant.price",
      transform: "sale_from_list",
      transform_params: { multiplier: 0.95 },
    },
  );

  const hasTarget = (target: ColumnMapping["target"]) =>
    Object.values(column_map).some((entry) => entry.target === target);

  if (!hasTarget("template_suffix")) {
    const templateColumn = findExcelColumn(table, CORE_ALIASES.template_suffix);
    if (templateColumn && !column_map[templateColumn]) {
      column_map[templateColumn] = {
        target: "template_suffix",
        transform: "slugify",
      };
    }
  }

  const titleColumn =
    Object.entries(column_map).find(([, entry]) => entry.target === "title")?.[0] ??
    "";

  const extra_mappings = (mapping.extra_mappings ?? []).filter(
    (entry) => table.headers.includes(entry.source_column) && entry.target !== "ignore",
  );

  const arthenicTemplate = detectArthenicTemplate(table.headers);

  return {
    ...mapping,
    column_map,
    ...(extra_mappings.length > 0 ? { extra_mappings } : {}),
    template_map: {
      painting: "paintings",
      paintings: "paintings",
      ethnic: "ethnic-wear",
      jewel: "jewellery",
      jewellery: "jewellery",
      decor: "sculpture",
      sculpture: "sculpture",
      ...(arthenicTemplate ? { [arthenicTemplate]: arthenicTemplate } : {}),
      ...mapping.template_map,
    },
    handle_strategy: {
      primary: "slugify",
      source_column: titleColumn || mapping.handle_strategy?.source_column || "",
      overrides: mapping.handle_strategy?.overrides ?? {},
    },
  };
}

export function assertMappingHasTitleColumn(
  table: ExcelTable,
  mapping: MappingConfig,
): void {
  const titleEntry = Object.entries(mapping.column_map).find(
    ([, entry]) => entry.target === "title",
  );
  if (!titleEntry) {
    throw new Error("Mapping missing title column");
  }
  const [sourceColumn] = titleEntry;
  if (!table.headers.includes(sourceColumn)) {
    throw new Error(`Title column "${sourceColumn}" not found in Excel headers`);
  }
  const hasValue = table.rows.some(
    (row) => (row[table.headers.indexOf(sourceColumn)] ?? "").trim().length > 0,
  );
  if (!hasValue) {
    throw new Error(`Title column "${sourceColumn}" is empty in all rows`);
  }
}
