import type { ExcelTable } from "@/lib/import/excel-parse";
import { detectArthenicTemplate, findExcelColumn } from "@/lib/import/spec/mapping-resolve";
import type {
  ImportPolicy,
  MappingConfig,
  ProductDraft,
  StoreSchema,
  TransformId,
} from "@/lib/import/spec/types";
import {
  cleanText,
  commaToList,
  faqColumns,
  htmlParagraphs,
  impactStats,
  kvColumn,
  kvLines,
  linesToList,
  saleFromList,
  serializeMetafieldValue,
  slugify,
  storyHeritageJson,
  storyMakerJson,
  storyProcessJson,
  storyStylingJson,
} from "@/lib/import/spec/transforms";

function coerceJsonMetafieldValue(
  key: string,
  raw: string,
  policy: ImportPolicy,
): Record<string, unknown> {
  const lowered = key.toLowerCase();
  if (/maker|weaver|artist|curator/.test(lowered)) {
    return storyMakerJson(raw, policy);
  }
  if (/process|making|craft/.test(lowered)) {
    return storyProcessJson(raw, policy);
  }
  if (/styling|occasion/.test(lowered)) {
    return storyStylingJson(raw, policy);
  }
  if (/heritage|fabric|tradition|culture/.test(lowered)) {
    return storyHeritageJson(raw, policy);
  }
  const text = cleanText(raw, policy);
  return text ? { body: text } : {};
}

function normalizeHeaderKey(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getRowValue(row: Record<string, string>, column: string): string {
  const direct = row[column];
  if (direct !== undefined) {
    return direct;
  }
  const normalized = normalizeHeaderKey(column);
  for (const [key, value] of Object.entries(row)) {
    if (normalizeHeaderKey(key) === normalized) {
      return value;
    }
  }
  return "";
}

function rowRecord(table: ExcelTable, rowIndex: number): Record<string, string> {
  const record: Record<string, string> = {};
  table.headers.forEach((header, columnIndex) => {
    record[header] = (table.rows[rowIndex]?.[columnIndex] ?? "").trim();
  });
  return record;
}

function applyTransform(
  transform: TransformId,
  raw: string,
  policy: ImportPolicy,
  params?: Record<string, unknown>,
): unknown {
  switch (transform) {
    case "identity":
      return cleanText(raw, policy);
    case "clean_text":
    case "skip_placeholder":
      return cleanText(raw, policy);
    case "slugify":
      return slugify(raw, policy);
    case "html_paragraphs":
      return htmlParagraphs(raw, policy);
    case "lines_to_list":
      return linesToList(raw, policy);
    case "comma_to_list":
      return commaToList(raw, policy);
    case "kv_lines":
      return kvLines(raw, policy);
    case "impact_stats":
      return impactStats(raw, policy);
    case "faq_columns":
      return faqColumns(raw, policy);
    case "sale_from_list":
      return saleFromList(
        raw,
        policy,
        typeof params?.multiplier === "number" ? params.multiplier : undefined,
      );
    case "story_maker_json":
      return storyMakerJson(raw, policy);
    case "story_process_json":
      return storyProcessJson(raw, policy);
    case "story_heritage_json":
      return storyHeritageJson(raw, policy);
    case "story_styling_json":
      return storyStylingJson(raw, policy);
    case "impact_note":
      return cleanText(raw, policy);
    case "dimensions_block":
      return { note: cleanText(raw, policy) };
    case "kv_column":
      return kvColumn(
        raw,
        policy,
        typeof params?.kv_label === "string" ? params.kv_label : undefined,
      );
    default:
      return cleanText(raw, policy);
  }
}

function resolveHandle(
  row: Record<string, string>,
  mapping: MappingConfig,
  policy: ImportPolicy,
  title: string,
): string {
  for (const [sourceColumn, columnMapping] of Object.entries(mapping.column_map)) {
    if (columnMapping.target === "handle" && getRowValue(row, sourceColumn)) {
      const handle = slugify(getRowValue(row, sourceColumn), policy);
      if (handle) {
        return handle;
      }
    }
  }

  const sourceColumn = mapping.handle_strategy?.source_column;
  const sourceValue = sourceColumn ? getRowValue(row, sourceColumn) : title;
  const override =
    mapping.handle_overrides[sourceValue] ??
    mapping.handle_strategy?.overrides?.[sourceValue];
  if (override) {
    return slugify(override, policy);
  }
  return slugify(title, policy);
}

function resolveTemplateSuffix(
  row: Record<string, string>,
  mapping: MappingConfig,
  policy: ImportPolicy,
): string {
  for (const [sourceColumn, columnMapping] of Object.entries(mapping.column_map)) {
    if (columnMapping.target !== "template_suffix") {
      continue;
    }
    const raw = getRowValue(row, sourceColumn);
    const cleaned = cleanText(raw, policy);
    if (!cleaned) {
      continue;
    }
    const lowered = cleaned.toLowerCase();
    for (const [needle, suffix] of Object.entries(mapping.template_map)) {
      if (lowered.includes(needle.toLowerCase())) {
        return suffix;
      }
    }
    return slugify(cleaned, policy);
  }
  return "";
}

function fieldTypeForMetafield(
  schema: StoreSchema,
  namespace: string,
  key: string,
): string {
  const field = schema.metafields.find(
    (entry) => entry.namespace === namespace && entry.key === key,
  );
  return field?.shopify_type ?? "single_line_text_field";
}

export function buildProductDrafts(
  table: ExcelTable,
  mapping: MappingConfig,
  schema: StoreSchema,
  policy: ImportPolicy,
): ProductDraft[] {
  const drafts: ProductDraft[] = [];

  for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
    const row = rowRecord(table, rowIndex);
    const warnings: string[] = [];
    const errors: string[] = [];
    const metafields: ProductDraft["metafields"] = [];

    let title = "";
    let bodyHtml = "";
    let handle = "";
    let templateSuffix = "";
    let price = "";
    let compareAt = "";
    let sku = "";

    for (const [sourceColumn, columnMapping] of Object.entries(mapping.column_map)) {
      if (columnMapping.target === "ignore") {
        continue;
      }
      const raw = getRowValue(row, sourceColumn);
      let transformed = applyTransform(
        columnMapping.transform,
        raw,
        policy,
        columnMapping.transform_params,
      );

      switch (columnMapping.target) {
        case "title":
          title = String(transformed ?? "").trim();
          break;
        case "body_html":
          bodyHtml = String(transformed ?? "").trim();
          break;
        case "handle":
          handle = String(transformed ?? "").trim();
          break;
        case "template_suffix":
          templateSuffix = String(transformed ?? "").trim();
          break;
        case "variant.price":
          if (
            transformed &&
            typeof transformed === "object" &&
            transformed !== null &&
            "price" in transformed
          ) {
            const priced = transformed as { price?: string; compare_at?: string };
            price = String(priced.price ?? "");
            compareAt = String(priced.compare_at ?? "");
          } else {
            price = String(transformed ?? "").trim();
          }
          break;
        case "variant.compare_at_price":
          compareAt = String(transformed ?? "").trim();
          break;
        case "variant.sku":
          sku = String(transformed ?? "").trim();
          break;
        case "metafield": {
          if (!columnMapping.namespace || !columnMapping.key) {
            warnings.push(`metafield mapping missing namespace/key for ${sourceColumn}`);
            break;
          }
          const shopifyType = fieldTypeForMetafield(
            schema,
            columnMapping.namespace,
            columnMapping.key,
          );
          if (
            shopifyType === "json" &&
            typeof transformed === "string" &&
            transformed.trim()
          ) {
            transformed = coerceJsonMetafieldValue(
              columnMapping.key,
              transformed,
              policy,
            );
          }
          if (
            (shopifyType === "json" || shopifyType.startsWith("list.")) &&
            typeof transformed === "string" &&
            transformed &&
            !transformed.startsWith("[") &&
            !transformed.startsWith("{")
          ) {
            errors.push(
              `TYPE_MISMATCH: ${columnMapping.namespace}.${columnMapping.key}`,
            );
            break;
          }
          const serialized = serializeMetafieldValue(shopifyType, transformed);
          if (!serialized) {
            break;
          }
          metafields.push({
            namespace: columnMapping.namespace,
            key: columnMapping.key,
            type: shopifyType,
            value: serialized,
            merge_strategy: columnMapping.merge_strategy,
          });
          break;
        }
        default:
          break;
      }
    }

    if (!title) {
      const titleColumn = findExcelColumn(table, [
        "product name",
        "painting title",
        "product title",
        "title",
        "name",
      ]);
      if (titleColumn) {
        title = cleanText(getRowValue(row, titleColumn), policy);
      }
    }

    if (!title) {
      errors.push("TITLE_REQUIRED");
    }
    if (!handle) {
      handle = resolveHandle(row, mapping, policy, title);
    }
    if (!templateSuffix) {
      templateSuffix =
        resolveTemplateSuffix(row, mapping, policy) ||
        detectArthenicTemplate(table.headers) ||
        "";
    }
    if (!handle) {
      errors.push("HANDLE_REQUIRED");
    }

    drafts.push({
      handle,
      action: "create",
      title,
      body_html: bodyHtml || undefined,
      template_suffix: templateSuffix || undefined,
      variants: [{ sku: sku || undefined, price: price || undefined, compare_at_price: compareAt || undefined }],
      metafields,
      warnings,
      errors,
    });
  }

  return drafts;
}

/** ponytail: assert-based self-check */
export function runTransformEngineSelfCheck(): void {
  const table = {
    sheetName: "Sheet1",
    headers: ["Product Name", "MRP", "Details"],
    rows: [["Saree", "10000", "K: Fabric V: Silk"]],
  };
  const schema: StoreSchema = {
    schema_version: 1,
    shop: "test.myshopify.com",
    discovered_at: new Date().toISOString(),
    product_templates: [],
    metafields: [
      {
        namespace: "custom",
        key: "product_details",
        shopify_type: "list.single_line_text_field",
        value_kind: "string_list",
        parse_hint: "kv_lines",
        name: "Details",
        required_for_storefront: true,
        in_theme: true,
        theme_files: [],
        aliases: [],
      },
    ],
  };
  const mapping: MappingConfig = {
    excel: { header_row: 1 },
    column_map: {
      "Product Name": { target: "title", transform: "clean_text" },
      MRP: {
        target: "variant.price",
        transform: "sale_from_list",
        transform_params: { multiplier: 0.95 },
      },
      Details: {
        target: "metafield",
        namespace: "custom",
        key: "product_details",
        transform: "kv_lines",
      },
    },
    handle_overrides: {},
    template_map: {},
    handle_strategy: { primary: "slugify", source_column: "Product Name", overrides: {} },
  };
  const policy = {
    frozen_fields: [],
    compare_at_from_list_price: true,
    match_strategy: "handle" as const,
    create_missing: true,
    update_existing: true,
    default_status: "DRAFT" as const,
    placeholder_values: ["nan"],
    sale_price_multiplier: 0.95,
  };
  const drafts = buildProductDrafts(table, mapping, schema, policy);
  if (drafts[0]?.title !== "Saree") {
    throw new Error("transform engine title failed");
  }
  if (drafts[0]?.variants[0]?.price !== "9500") {
    throw new Error("transform engine price failed");
  }
}
