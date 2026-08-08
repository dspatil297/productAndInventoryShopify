import type { ImportPromptPackField } from "@/lib/import/prompt-pack";
import {
  detectListLineFormatFromRaw,
  listItemsToPairs,
  listValueToPairJson,
  pairsToListItems,
} from "@/lib/metafields/list-line-formats";
import { encodeStructuredPairs } from "@/lib/metafields/structured-json";
import { normalizeMetafieldValue } from "@/lib/metafields/validators";
import { parseListEditorItems } from "@/lib/metafields/display";

const PLACEHOLDER_VALUES = new Set([
  "common",
  "nan",
  "none",
  "n/a",
  "as per the pictures",
  "same questions as mentioned in word",
]);

export function cleanSpreadsheetText(value: string): string {
  let text = value.trim();
  if (!text) {
    return "";
  }
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  text = text
    .replace(/\uFFFD/g, "")
    .replace(/[–—]/g, "-")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"');
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export function isPlaceholderValue(value: string): boolean {
  return PLACEHOLDER_VALUES.has(cleanSpreadsheetText(value).toLowerCase());
}

export function slugifyTemplateSuffix(value: string): string {
  return cleanSpreadsheetText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizePriceCell(value: string): string {
  const text = cleanSpreadsheetText(value).replace(/[₹$€£,\s]/g, "");
  if (!text || !/^-?\d+(\.\d+)?$/.test(text)) {
    return cleanSpreadsheetText(value);
  }
  const num = Number.parseFloat(text);
  if (!Number.isFinite(num)) {
    return "";
  }
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

function tryLabelValueLines(value: string): string | null {
  const lines = value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    return null;
  }
  const pairs: Array<{ left: string; right: string }> = [];
  for (const line of lines) {
    const match = line.match(/^([^:]{1,80}):\s*(.+)$/);
    if (!match) {
      return null;
    }
    pairs.push({ left: match[1].trim(), right: match[2].trim() });
  }
  if (pairs.length === 0) {
    return null;
  }
  return encodeStructuredPairs(pairs, "k", "v");
}

function normalizeJsonImportCell(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // continue
  }

  const lineFormat = detectListLineFormatFromRaw(trimmed);
  if (lineFormat) {
    const pairJson = listValueToPairJson(trimmed);
    if (pairJson) {
      const items = parseListEditorItems(pairJson.hiddenValue);
      const pairs = listItemsToPairs(items, pairJson.format);
      const leftKey = pairJson.mode === "faq" ? "q" : "k";
      const rightKey = pairJson.mode === "faq" ? "a" : "v";
      return encodeStructuredPairs(pairs, leftKey, rightKey);
    }
  }

  const labelValueJson = tryLabelValueLines(trimmed);
  if (labelValueJson) {
    return labelValueJson;
  }

  return JSON.stringify(trimmed);
}

function normalizeListImportCell(typeName: string, value: string): string {
  const lineFormat = detectListLineFormatFromRaw(value);
  if (lineFormat) {
    const pairJson = listValueToPairJson(value);
    if (pairJson?.storage === "list_lines") {
      return pairJson.hiddenValue;
    }
    if (pairJson) {
      const items = parseListEditorItems(pairJson.hiddenValue);
      return JSON.stringify(pairsToListItems(listItemsToPairs(items, lineFormat), lineFormat));
    }
  }
  return normalizeMetafieldValue(typeName, value);
}

export function deterministicCleanRow(
  row: Record<string, string>,
  fields: ImportPromptPackField[],
): Record<string, string> {
  const fieldByHeader = new Map(fields.map((field) => [field.header, field]));
  const out: Record<string, string> = {};

  for (const [header, raw] of Object.entries(row)) {
    const field = fieldByHeader.get(header);
    const value = cleanSpreadsheetText(raw);
    if (!value || isPlaceholderValue(value)) {
      out[header] = "";
      continue;
    }

    if (header === "template_suffix") {
      out[header] = slugifyTemplateSuffix(value);
      continue;
    }
    if (header === "price" || header === "compare_at_price") {
      out[header] = normalizePriceCell(value);
      continue;
    }
    if (header === "status") {
      const upper = value.toUpperCase();
      out[header] =
        upper === "ACTIVE" || upper === "DRAFT" || upper === "ARCHIVED"
          ? upper
          : value;
      continue;
    }
    if (field?.kind === "metafield" && field.type) {
      if (field.type === "json") {
        out[header] = normalizeJsonImportCell(value);
        continue;
      }
      if (field.type.startsWith("list.")) {
        out[header] = normalizeListImportCell(field.type, value);
        continue;
      }
      out[header] = normalizeMetafieldValue(field.type, value);
      continue;
    }

    out[header] = value;
  }

  return out;
}

/** ponytail: assert-based self-check */
export function runDeterministicCleanSelfCheck(): void {
  const row = deterministicCleanRow(
    {
      title: "  Test Product  ",
      template_suffix: "Ethnic Wear",
      price: "₹1,299.50",
      "custom.tags": "red\nblue",
    },
    [
      { header: "title", kind: "base", label: "t", hint: "" },
      { header: "template_suffix", kind: "base", label: "t", hint: "" },
      { header: "price", kind: "base", label: "p", hint: "" },
      {
        header: "custom.tags",
        kind: "metafield",
        type: "list.single_line_text_field",
        label: "tags",
        hint: "",
      },
    ],
  );
  if (row.template_suffix !== "ethnic-wear") {
    throw new Error("slugify failed");
  }
  if (row.price !== "1299.50") {
    throw new Error("price normalize failed");
  }
}
