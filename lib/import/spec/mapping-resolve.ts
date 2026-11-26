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
  template_suffix: [
    "template",
    "theme",
    "template suffix",
    "product template",
    "page template",
  ],
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
    if (normalized.length < 4) {
      continue;
    }
    for (const candidate of candidates) {
      const normCandidate = normalizeHeader(candidate);
      if (normCandidate.length < 4) {
        continue;
      }
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
  exactOnly = false,
): void {
  const column = exactOnly
    ? (table.headers.find((h) =>
        candidates.some((c) => normalizeHeader(h) === normalizeHeader(c)),
      ) ?? null)
    : findExcelColumn(table, candidates);
  if (!column) {
    return;
  }
  const existing = column_map[column];
  if (
    existing &&
    (existing.target !== mapping.target ||
      existing.namespace !== mapping.namespace ||
      existing.key !== mapping.key)
  ) {
    if (extra_mappings) {
      const alreadyExtra = extra_mappings.some(
        (item) =>
          item.source_column === column &&
          item.target === mapping.target &&
          item.namespace === mapping.namespace &&
          item.key === mapping.key,
      );
      if (!alreadyExtra) {
        extra_mappings.push({ source_column: column, ...mapping });
      }
    }
    return;
  }
  column_map[column] = mapping;
}

function bindDecorProfile(
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
    bindColumn(table, column_map, candidates, kvDetailMapping(label), extra_mappings);
  }

  bindColumn(
    table,
    column_map,
    ["dimensions & scale", "dimensions"],
    metafieldMapping("custom", "product_measurements", "dimensions_block", "merge_kv"),
    extra_mappings,
  );
  bindColumn(
    table,
    column_map,
    ["dimensions & scale", "dimensions"],
    metafieldMapping("custom", "product_measurement_highlight", "dimensions_block", "replace", {
      part: "highlight",
    }),
    extra_mappings,
  );
  bindColumn(
    table,
    column_map,
    ["dimensions & scale", "dimensions"],
    metafieldMapping("custom", "product_measurement_note", "dimensions_block", "replace", {
      part: "note",
    }),
    extra_mappings,
  );
  bindColumn(table, column_map, ["whats included"], {
    ...metafieldMapping("custom", "product_whats_included", "lines_to_list"),
  }, extra_mappings);
  bindColumn(table, column_map, ["artisan impact"], {
    ...metafieldMapping("custom", "product_impact_stats", "impact_stats"),
  }, extra_mappings);
  bindColumn(
    table,
    column_map,
    ["artisan impact"],
    metafieldMapping("custom", "product_impact_note", "impact_note"),
    extra_mappings,
  );
  bindColumn(table, column_map, ["care instructions"], {
    ...metafieldMapping("custom", "product_care_instructions", "lines_to_list"),
  }, extra_mappings);
  bindColumn(table, column_map, ["the maker"], {
    ...metafieldMapping("custom", "product_maker_story", "story_maker_json"),
  }, extra_mappings);
  bindColumn(table, column_map, ["how its made", "how it's made"], {
    ...metafieldMapping("custom", "product_process_story", "story_process_json"),
  }, extra_mappings);
  bindColumn(table, column_map, ["artistry behind"], {
    ...metafieldMapping("custom", "product_heritage_story", "story_heritage_json"),
  }, extra_mappings);
  bindColumn(
    table,
    column_map,
    ["application and styling"],
    metafieldMapping("custom", "pdp_styling_story", "story_styling_json"),
    extra_mappings,
  );
  bindColumn(table, column_map, ["faqs", "faq"], {
    ...metafieldMapping("custom", "product_faq", "faq_columns"),
  }, extra_mappings);
  bindColumn(
    table,
    column_map,
    ["material"],
    metafieldMapping("custom", "filter_material", "clean_text"),
    extra_mappings,
  );
  bindColumn(
    table,
    column_map,
    ["sculpture type"],
    metafieldMapping("custom", "filter_product_type", "clean_text"),
    extra_mappings,
  );
  bindColumn(
    table,
    column_map,
    ["craft tradition"],
    metafieldMapping("custom", "filter_tradition", "clean_text"),
    extra_mappings,
  );
  bindColumn(
    table,
    column_map,
    ["usage"],
    metafieldMapping("custom", "filter_occasion", "comma_to_list"),
    extra_mappings,
  );
}

function bindPaintingsProfile(
  table: ExcelTable,
  column_map: MappingConfig["column_map"],
  extra_mappings: ExtraColumnMapping[],
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

  const detailColumns: Array<[string[], string]> = [
    [["tradition"], "Tradition"],
    [["region"], "Region"],
    [["medium"], "Medium"],
    [["canvas preparation"], "Canvas preparation"],
    [["pigments"], "Pigments"],
    [["outline technique"], "Outline technique"],
    [["style"], "Style"],
    [["originality"], "Originality"],
    [["year"], "Year"],
    [["paintning details subject", "painting details subject", "subject"], "Subject"],
    [["framing options"], "Framing"],
  ];
  for (const [candidates, label] of detailColumns) {
    bindColumn(table, column_map, candidates, kvDetailMapping(label), extra_mappings, true);
  }

  bindColumn(
    table,
    column_map,
    ["canvas size"],
    metafieldMapping("custom", "product_measurements", "dimensions_block", "merge_kv"),
    extra_mappings,
  );
  bindColumn(
    table,
    column_map,
    ["what s included", "whats included"],
    metafieldMapping("custom", "product_whats_included", "lines_to_list"),
    extra_mappings,
  );
  bindColumn(
    table,
    column_map,
    ["care display", "care & display", "care instructions"],
    metafieldMapping("custom", "product_care_instructions", "lines_to_list"),
    extra_mappings,
  );
  bindColumn(
    table,
    column_map,
    ["artisan impact"],
    metafieldMapping("custom", "product_impact_stats", "impact_stats"),
    extra_mappings,
  );
  bindColumn(
    table,
    column_map,
    ["artisan impact"],
    metafieldMapping("custom", "product_impact_note", "impact_note"),
    extra_mappings,
  );
  for (const faqCol of ["FAQ 1", "FAQ 2", "FAQ 3", "FAQ 4", "FAQ 5", "FAQ 6"]) {
    bindColumn(
      table,
      column_map,
      [faqCol],
      metafieldMapping("custom", "product_faq", "faq_columns"),
      extra_mappings,
      true,
    );
  }
  bindColumn(
    table,
    column_map,
    ["artist"],
    metafieldMapping("custom", "product_maker_story", "story_maker_json"),
    extra_mappings,
    true,
  );
  bindColumn(
    table,
    column_map,
    ["how it s made heading", "how it's made - heading"],
    metafieldMapping("custom", "product_process_story", "story_process_json"),
    extra_mappings,
  );
  const processStepCols: Array<[string, string]> = [
    ["Canvas Preparation Process", "Canvas preparation"],
    ["Detailing & Brushwork", "Detailing & brushwork"],
    ["Color Layering & Finishing", "Color layering & finishing"],
  ];
  for (const [colName, stepTitle] of processStepCols) {
    bindColumn(
      table,
      column_map,
      [colName],
      metafieldMapping("custom", "product_process_story", "story_process_json", "replace", {
        step_title: stepTitle,
      }),
      extra_mappings,
      true,
    );
  }
  bindColumn(
    table,
    column_map,
    ["understanding the painting heading", "understanding the painting - heading"],
    metafieldMapping("custom", "product_heritage_story", "story_heritage_json"),
    extra_mappings,
  );
  bindColumn(
    table,
    column_map,
    ["paintning details subject", "painting details subject"],
    metafieldMapping("custom", "filter_subject", "clean_text"),
    extra_mappings,
    true,
  );
  bindColumn(
    table,
    column_map,
    ["region"],
    metafieldMapping("custom", "filter_region", "clean_text"),
    extra_mappings,
    true,
  );
  bindColumn(
    table,
    column_map,
    ["style"],
    metafieldMapping("custom", "filter_style", "clean_text"),
    extra_mappings,
    true,
  );
  bindColumn(
    table,
    column_map,
    ["tradition"],
    metafieldMapping("custom", "filter_tradition", "clean_text"),
    extra_mappings,
    true,
  );
  bindColumn(
    table,
    column_map,
    ["medium"],
    metafieldMapping("custom", "filter_material", "clean_text"),
    extra_mappings,
    true,
  );
}

function bindEthnicProfile(
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
  bindColumn(table, column_map, ["one liner", "one-liner", "short description", "description"], {
    target: "body_html",
    transform: "html_paragraphs",
  });

  const detailColumns: Array<[string[], string]> = [
    [["outfit type"], "Outfit type"],
    [["fabric 2", "fabric"], "Fabric"],
    [["color palatte", "color"], "Color"],
    [["work style", "craft technique"], "Craft technique"],
    [["design pattern", "pattern"], "Pattern"],
    [["fit", "sleeve style"], "Style"],
    [["occasion"], "Occasion"],
    [["set includes 2", "set includes"], "Set includes"],
    [["origin"], "Origin"],
    [["style inspiration"], "Style inspiration"],
    [["weight"], "Weight"],
  ];
  for (const [candidates, label] of detailColumns) {
    bindColumn(table, column_map, candidates, kvDetailMapping(label), extra_mappings, true);
  }

  for (const [sizeCol, label] of [
    ["S", "Size S"],
    ["M", "Size M"],
    ["L", "Size L"],
  ] as const) {
    bindColumn(
      table,
      column_map,
      [sizeCol],
      metafieldMapping("custom", "product_measurements", "kv_column", "merge_kv", {
        kv_label: label,
      }),
      extra_mappings,
      true,
    );
  }
  bindColumn(
    table,
    column_map,
    ["size guides in inches", "size guides"],
    metafieldMapping("custom", "product_measurement_note", "clean_text"),
    extra_mappings,
  );
  bindColumn(table, column_map, ["whats included", "what's included"], {
    ...metafieldMapping("custom", "product_whats_included", "lines_to_list"),
  }, extra_mappings);
  bindColumn(table, column_map, ["care instruction", "care instructions"], {
    ...metafieldMapping("custom", "product_care_instructions", "lines_to_list"),
  }, extra_mappings);
  bindColumn(table, column_map, ["artisans impact", "artisan impact"], {
    ...metafieldMapping("custom", "product_impact_stats", "impact_stats"),
  }, extra_mappings);
  bindColumn(
    table,
    column_map,
    ["artisans impact", "artisan impact"],
    metafieldMapping("custom", "product_impact_note", "impact_note"),
    extra_mappings,
  );
  bindColumn(
    table,
    column_map,
    ["faqs", "faq"],
    metafieldMapping("custom", "product_faq", "faq_columns"),
    extra_mappings,
  );
  bindColumn(
    table,
    column_map,
    ["the weaver", "the curation story", "the maker", "curation story"],
    metafieldMapping("custom", "product_maker_story", "story_maker_json"),
    extra_mappings,
  );
  bindColumn(
    table,
    column_map,
    ["the making", "how it's made", "how its made"],
    metafieldMapping("custom", "product_process_story", "story_process_json"),
    extra_mappings,
  );
  bindColumn(
    table,
    column_map,
    ["the fabric", "the tradition", "the heritage", "heritage story"],
    metafieldMapping("custom", "product_heritage_story", "story_heritage_json"),
    extra_mappings,
    true,
  );
  bindColumn(
    table,
    column_map,
    ["color"],
    metafieldMapping("custom", "filter_color", "clean_text"),
    extra_mappings,
    true,
  );
  bindColumn(
    table,
    column_map,
    ["fabric 2", "fabric"],
    metafieldMapping("custom", "filter_fabric", "clean_text"),
    extra_mappings,
    true,
  );
  bindColumn(
    table,
    column_map,
    ["outfit type"],
    metafieldMapping("custom", "filter_product_type", "clean_text"),
    extra_mappings,
    true,
  );
  bindColumn(
    table,
    column_map,
    ["occasion"],
    metafieldMapping("custom", "filter_occasion", "comma_to_list"),
    extra_mappings,
    true,
  );
  bindColumn(
    table,
    column_map,
    ["craft technique", "work style"],
    metafieldMapping("custom", "filter_tradition", "clean_text"),
    extra_mappings,
    true,
  );
  bindColumn(
    table,
    column_map,
    ["origin"],
    metafieldMapping("custom", "filter_region", "clean_text"),
    extra_mappings,
    true,
  );
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
  bindColumn(table, column_map, ["jewellery type", "jewelry type"], {
    ...metafieldMapping("custom", "filter_product_type", "clean_text"),
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
    bindDecorProfile(table, column_map, extra_mappings);
  } else if (template === "paintings") {
    bindPaintingsProfile(table, column_map, extra_mappings);
  } else if (template === "ethnic-wear") {
    bindEthnicProfile(table, column_map, extra_mappings);
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

export function mergeMissingMappings(
  table: ExcelTable,
  primary: MappingConfig,
  fallback: MappingConfig,
): MappingConfig {
  const column_map = { ...primary.column_map };
  const extra_mappings = [...(primary.extra_mappings ?? [])];

  // Drop empty summary "Product Details" mapping if individual kv_column mappings exist
  const hasIndividualDetails = Object.values(fallback.column_map).some(
    (entry) =>
      entry.target === "metafield" &&
      entry.namespace === "custom" &&
      entry.key === "product_details" &&
      entry.transform === "kv_column",
  );
  if (hasIndividualDetails && column_map["Product Details"]?.key === "product_details") {
    const colIndex = table.headers.indexOf("Product Details");
    const allEmpty =
      colIndex >= 0 &&
      table.rows.every((row) => !(row[colIndex] ?? "").trim());
    if (allEmpty) {
      delete column_map["Product Details"];
    }
  }

  for (const [col, entry] of Object.entries(fallback.column_map)) {
    if (!column_map[col]) {
      column_map[col] = entry;
      continue;
    }
    const cur = column_map[col];
    const sameMetafield =
      cur.target === "metafield" &&
      entry.target === "metafield" &&
      cur.namespace === entry.namespace &&
      cur.key === entry.key;
    if (sameMetafield && cur.transform === "identity") {
      column_map[col] = entry;
    } else if (
      entry.target === "metafield" &&
      cur.target === "metafield" &&
      (cur.namespace !== entry.namespace || cur.key !== entry.key)
    ) {
      const alreadyExtra = extra_mappings.some(
        (item) =>
          item.source_column === col &&
          item.target === entry.target &&
          item.namespace === entry.namespace &&
          item.key === entry.key,
      );
      if (!alreadyExtra) {
        extra_mappings.push({ source_column: col, ...entry });
      }
    }
  }

  for (const extra of fallback.extra_mappings ?? []) {
    const primaryCol = column_map[extra.source_column];
    const coveredByPrimary =
      primaryCol &&
      primaryCol.target === extra.target &&
      primaryCol.namespace === extra.namespace &&
      primaryCol.key === extra.key;
    if (coveredByPrimary) {
      continue;
    }
    const alreadyExtra = extra_mappings.some(
      (item) =>
        item.source_column === extra.source_column &&
        item.target === extra.target &&
        item.namespace === extra.namespace &&
        item.key === extra.key,
    );
    if (!alreadyExtra) {
      extra_mappings.push(extra);
    }
  }

  return {
    ...primary,
    column_map,
    ...(extra_mappings.length > 0 ? { extra_mappings } : {}),
  };
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
