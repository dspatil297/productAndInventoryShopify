import type { Shop } from "@/generated/prisma/client";
import { metafieldColumnKey } from "@/lib/metafields/types";
import { isUnsupportedMetafieldType } from "@/lib/metafields/validators";
import type { CreateProductInput } from "@/lib/products/create-product";
import { createShopProduct } from "@/lib/products/create-product";
import type { MetafieldDefinitionNode } from "@/types/shopify";

const BASE_HEADERS = [
  "title",
  "handle",
  "description",
  "product_type",
  "vendor",
  "status",
  "price",
  "compare_at_price",
  "sku",
  "track_inventory",
  "inventory_qty",
  "location_id",
  "inventory_policy",
  "template_suffix",
] as const;

export const PRODUCT_IMPORT_BASE_HEADER_COUNT = BASE_HEADERS.length;

export interface ProductImportRow {
  rowNumber: number;
  input: CreateProductInput;
}

export interface ProductImportResult {
  created: number;
  failed: number;
  errors: Array<{ rowNumber: number; message: string }>;
}

function escapeCsvValue(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Minimal RFC4180 CSV parser. Ceiling: no multiline without quotes edge-case fuzzing. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    // Skip trailing empty line
    if (row.length === 1 && row[0] === "" && rows.length > 0) {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = false;
        continue;
      }
      field += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      pushField();
      continue;
    }
    if (char === "\n") {
      pushField();
      pushRow();
      continue;
    }
    if (char === "\r") {
      continue;
    }
    field += char;
  }

  if (field.length > 0 || row.length > 0 || inQuotes) {
    pushField();
    pushRow();
  }

  return rows;
}

export function productImportHeaders(
  definitions: MetafieldDefinitionNode[],
): string[] {
  const metafieldHeaders = definitions
    .filter((definition) => !isUnsupportedMetafieldType(definition.type.name))
    .map((definition) => metafieldColumnKey(definition.namespace, definition.key));

  return [...BASE_HEADERS, ...metafieldHeaders];
}

export function buildProductImportTemplate(
  definitions: MetafieldDefinitionNode[],
): string {
  const headers = productImportHeaders(definitions);
  return `${headers.map(escapeCsvValue).join(",")}\n`;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

export function mapCsvToProductRows(
  csvText: string,
  definitions: MetafieldDefinitionNode[],
  options?: { defaultTemplateSuffix?: string | null },
): { rows: ProductImportRow[]; errors: Array<{ rowNumber: number; message: string }> } {
  const table = parseCsv(csvText);
  if (table.length === 0) {
    return { rows: [], errors: [{ rowNumber: 0, message: "CSV is empty" }] };
  }

  const headerRow = table[0].map(normalizeHeader);
  const titleIndex = headerRow.indexOf("title");
  if (titleIndex < 0) {
    return {
      rows: [],
      errors: [{ rowNumber: 1, message: "CSV must include a title column" }],
    };
  }

  const defByColumn = new Map(
    definitions
      .filter((definition) => !isUnsupportedMetafieldType(definition.type.name))
      .map((definition) => [
        metafieldColumnKey(definition.namespace, definition.key).toLowerCase(),
        definition,
      ]),
  );

  const rows: ProductImportRow[] = [];
  const errors: Array<{ rowNumber: number; message: string }> = [];

  for (let index = 1; index < table.length; index += 1) {
    const cells = table[index];
    const rowNumber = index + 1;
    const get = (name: string): string => {
      const columnIndex = headerRow.indexOf(name);
      if (columnIndex < 0) {
        return "";
      }
      return (cells[columnIndex] ?? "").trim();
    };

    const title = get("title");
    if (!title) {
      // blank line — skip
      if (cells.every((cell) => !cell.trim())) {
        continue;
      }
      errors.push({ rowNumber, message: "title is required" });
      continue;
    }

    const statusRaw = get("status").toUpperCase();
    const status =
      statusRaw === "ACTIVE" || statusRaw === "DRAFT" || statusRaw === "ARCHIVED"
        ? statusRaw
        : "ACTIVE";

    const trackRaw = get("track_inventory").toLowerCase();
    const trackInventory =
      trackRaw === "1" || trackRaw === "true" || trackRaw === "yes";
    const qtyRaw = get("inventory_qty");
    const inventoryQuantity =
      qtyRaw === "" ? null : Number.parseInt(qtyRaw, 10);
    const policyRaw = get("inventory_policy").toUpperCase();
    const inventoryPolicy =
      policyRaw === "CONTINUE" || policyRaw === "DENY" ? policyRaw : undefined;

    const suffixRaw = get("template_suffix");
    const templateSuffix =
      suffixRaw || options?.defaultTemplateSuffix?.trim() || undefined;

    const metafields: NonNullable<CreateProductInput["metafields"]> = [];
    for (let columnIndex = 0; columnIndex < headerRow.length; columnIndex += 1) {
      const header = headerRow[columnIndex];
      if (BASE_HEADERS.includes(header as (typeof BASE_HEADERS)[number])) {
        continue;
      }
      const value = (cells[columnIndex] ?? "").trim();
      if (!value) {
        continue;
      }
      const definition = defByColumn.get(header);
      if (definition) {
        metafields.push({
          namespace: definition.namespace,
          key: definition.key,
          type: definition.type.name,
          value,
        });
        continue;
      }
      const nsKeyMatch = /^([a-z0-9_-]+)\.([a-z0-9_-]+)$/.exec(header);
      if (!nsKeyMatch) {
        continue;
      }
      const inferredType = value.startsWith("{")
        ? "json"
        : value.startsWith("[")
          ? "list.single_line_text_field"
          : value.includes("\n")
            ? "multi_line_text_field"
            : "single_line_text_field";
      metafields.push({
        namespace: nsKeyMatch[1],
        key: nsKeyMatch[2],
        type: inferredType,
        value,
      });
    }

    rows.push({
      rowNumber,
      input: {
        title,
        handle: get("handle") || undefined,
        descriptionHtml: get("description") || undefined,
        productType: get("product_type") || undefined,
        vendor: get("vendor") || undefined,
        status,
        price: get("price") || undefined,
        compareAtPrice: get("compare_at_price") || undefined,
        sku: get("sku") || undefined,
        trackInventory,
        inventoryQuantity: Number.isFinite(inventoryQuantity)
          ? inventoryQuantity
          : null,
        locationId: get("location_id") || null,
        inventoryPolicy,
        publish: status === "ACTIVE",
        templateSuffix: templateSuffix ?? null,
        metafields,
      },
    });
  }

  return { rows, errors };
}

export async function importProductsFromCsv(
  shop: Shop,
  csvText: string,
  definitions: MetafieldDefinitionNode[],
  options?: { defaultTemplateSuffix?: string | null },
): Promise<ProductImportResult> {
  const mapped = mapCsvToProductRows(csvText, definitions, options);
  const errors = [...mapped.errors];
  let created = 0;

  for (const row of mapped.rows) {
    const result = await createShopProduct(shop, row.input);
    if (!result.productId) {
      errors.push({
        rowNumber: row.rowNumber,
        message: result.errors[0] ?? "Create failed",
      });
      continue;
    }
    created += 1;
    if (result.errors.length > 0) {
      errors.push({
        rowNumber: row.rowNumber,
        message: `Created with warnings: ${result.errors[0]}`,
      });
    }
  }

  return {
    created,
    failed: errors.filter((error) => !error.message.startsWith("Created with")).length,
    errors,
  };
}

/** ponytail: one assert-based self-check; upgrade to vitest if suite grows. */
export function runProductImportSelfCheck(): void {
  const parsed = parseCsv('title,custom.field\n"A, B",x\nC,"y""z"\n');
  if (parsed.length !== 3) {
    throw new Error(`expected 3 rows, got ${parsed.length}`);
  }
  if (parsed[1][0] !== "A, B") {
    throw new Error(`quoted comma broken: ${parsed[1][0]}`);
  }
  if (parsed[2][1] !== 'y"z') {
    throw new Error(`escaped quote broken: ${parsed[2][1]}`);
  }

  const fakeDefs: MetafieldDefinitionNode[] = [
    {
      id: "gid://shopify/MetafieldDefinition/1",
      name: "Field",
      namespace: "custom",
      key: "field",
      type: { name: "single_line_text_field" },
      description: null,
      validations: [],
    },
  ];

  const template = buildProductImportTemplate(fakeDefs);
  if (!template.includes("custom.field")) {
    throw new Error("template missing metafield column");
  }

  const mapped = mapCsvToProductRows(
    "title,custom.field\nShirt,blue\n",
    fakeDefs,
  );
  if (mapped.rows.length !== 1 || mapped.rows[0].input.title !== "Shirt") {
    throw new Error("mapCsvToProductRows failed");
  }
  if (mapped.rows[0].input.metafields?.[0]?.value !== "blue") {
    throw new Error("metafield column mapping failed");
  }
}
