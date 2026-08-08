import { createHash } from "node:crypto";
import {
  PRODUCT_IMPORT_BASE_HEADER_COUNT,
  productImportHeaders,
} from "@/lib/csv/productImport";
import { metafieldImportHint } from "@/lib/metafields/display";
import { metafieldColumnKey } from "@/lib/metafields/types";
import { isUnsupportedMetafieldType } from "@/lib/metafields/validators";
import type { MetafieldDefinitionNode } from "@/types/shopify";

const BASE_LABELS: Record<string, string> = {
  title: "Product title",
  handle: "URL handle (slug)",
  description: "Description (HTML allowed)",
  product_type: "Product type / category",
  vendor: "Vendor / brand",
  status: "ACTIVE, DRAFT, or ARCHIVED",
  price: "Variant price",
  compare_at_price: "Compare-at price",
  sku: "SKU",
  track_inventory: "true/false — track inventory",
  inventory_qty: "Stock quantity (integer)",
  location_id: "Shopify location GID (optional)",
  inventory_policy: "CONTINUE or DENY when out of stock",
  template_suffix: "Online Store product template suffix per row (empty = default product page). Match theme template names from your spreadsheet.",
};

export interface ImportPromptPackField {
  header: string;
  kind: "base" | "metafield";
  namespace?: string;
  key?: string;
  type?: string;
  label: string;
  hint: string;
}

export interface ImportPromptPack {
  version: string;
  builtAt: string;
  headers: string[];
  fields: ImportPromptPackField[];
}

export function hashMetafieldDefinitions(
  definitions: MetafieldDefinitionNode[],
): string {
  const payload = definitions
    .filter((definition) => !isUnsupportedMetafieldType(definition.type.name))
    .map((definition) => ({
      namespace: definition.namespace,
      key: definition.key,
      type: definition.type.name,
      name: definition.name,
    }));
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

export function buildImportPromptPack(
  definitions: MetafieldDefinitionNode[],
): ImportPromptPack {
  const headers = productImportHeaders(definitions);
  const baseHeaders = headers.slice(0, PRODUCT_IMPORT_BASE_HEADER_COUNT);
  const metafieldHeaders = headers.slice(PRODUCT_IMPORT_BASE_HEADER_COUNT);

  const defByColumn = new Map(
    definitions
      .filter((definition) => !isUnsupportedMetafieldType(definition.type.name))
      .map((definition) => [
        metafieldColumnKey(definition.namespace, definition.key),
        definition,
      ]),
  );

  const fields: ImportPromptPackField[] = baseHeaders.map((header) => ({
    header,
    kind: "base",
    label: BASE_LABELS[header] ?? header,
    hint: BASE_LABELS[header] ?? "product field",
  }));

  for (const header of metafieldHeaders) {
    const definition = defByColumn.get(header);
    fields.push({
      header,
      kind: "metafield",
      namespace: definition?.namespace,
      key: definition?.key,
      type: definition?.type.name,
      label: definition?.name ?? header,
      hint: definition
        ? metafieldImportHint(definition.type.name)
        : "metafield value",
    });
  }

  return {
    version: hashMetafieldDefinitions(definitions),
    builtAt: new Date().toISOString(),
    headers,
    fields,
  };
}

export function readImportPromptPackFromSettings(
  settings: unknown,
): ImportPromptPack | null {
  if (!settings || typeof settings !== "object") {
    return null;
  }
  const pack = (settings as Record<string, unknown>).importPromptPack;
  if (!pack || typeof pack !== "object") {
    return null;
  }
  const record = pack as Record<string, unknown>;
  if (
    typeof record.version !== "string" ||
    typeof record.builtAt !== "string" ||
    !Array.isArray(record.headers) ||
    !Array.isArray(record.fields)
  ) {
    return null;
  }
  return record as unknown as ImportPromptPack;
}

export function mergeImportPromptPackIntoSettings(
  settings: Record<string, unknown>,
  pack: ImportPromptPack,
): Record<string, unknown> {
  return {
    ...settings,
    importPromptPack: pack,
  };
}

export function promptPackForAi(pack: ImportPromptPack): string {
  const lines = pack.fields.map(
    (field) =>
      `- ${field.header} (${field.kind}): ${field.label}. Format: ${field.hint}`,
  );
  return `Target CSV columns for this store:\n${lines.join("\n")}`;
}

/** ponytail: assert-based self-check */
export function runImportPromptPackSelfCheck(): void {
  const defs: MetafieldDefinitionNode[] = [
    {
      id: "gid://shopify/MetafieldDefinition/1",
      name: "Color",
      namespace: "custom",
      key: "color",
      type: { name: "single_line_text_field" },
      description: null,
      validations: [],
    },
  ];
  const pack = buildImportPromptPack(defs);
  if (!pack.headers.includes("custom.color")) {
    throw new Error("prompt pack missing metafield header");
  }
  if (pack.version.length !== 16) {
    throw new Error("prompt pack version hash wrong length");
  }
  const again = buildImportPromptPack(defs);
  if (again.version !== pack.version) {
    throw new Error("prompt pack version not stable");
  }
}
