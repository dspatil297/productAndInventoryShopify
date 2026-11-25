import {
  cleanSpreadsheetText,
  isPlaceholderValue,
  slugifyTemplateSuffix,
} from "@/lib/import/deterministic-row-clean";
import type { ProductDraft } from "@/lib/import/spec/types";
import {
  buildHeritageStoryJson,
  buildMakerStoryJson,
  buildProcessStoryJson,
  buildStylingStoryJson,
} from "@/lib/import/spec/stories";
import type { ImportPolicy } from "@/lib/import/spec/types";

export function cleanText(value: unknown, policy: ImportPolicy): string {
  const text = cleanSpreadsheetText(String(value ?? ""));
  if (isPlaceholder(policy, text)) {
    return "";
  }
  return text;
}

export function isPlaceholder(policy: ImportPolicy, value: string): boolean {
  const lowered = cleanSpreadsheetText(value).toLowerCase();
  return (
    isPlaceholderValue(value) ||
    policy.placeholder_values.some((item) => item.toLowerCase() === lowered)
  );
}

export function slugify(value: unknown, policy: ImportPolicy): string {
  return slugifyTemplateSuffix(cleanText(value, policy));
}

export function htmlParagraphs(value: unknown, policy: ImportPolicy): string {
  const text = cleanText(value, policy);
  if (!text) {
    return "";
  }
  if (text.includes("<p>")) {
    return text;
  }
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("");
}

export function linesToList(value: unknown, policy: ImportPolicy): string[] {
  const text = cleanText(value, policy);
  if (!text) {
    return [];
  }
  const rows: string[] = [];
  // Split on newlines OR bullet symbols (•, ·, etc.)
  for (const chunk of text.split(/(?:\r?\n)+|(?:\s*[•·]\s*)/)) {
    const item = chunk.replace(/^[-–—•·]\s*/, "").trim();
    if (item && !isPlaceholder(policy, item)) {
      rows.push(item);
    }
  }
  return rows;
}

export function commaToList(value: unknown, policy: ImportPolicy): string[] {
  const text = cleanText(value, policy);
  if (!text) {
    return [];
  }
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const chunk of text.split(/[,;\r\n•·]+/)) {
    const item = chunk.replace(/^[-–—•·]\s*/, "").trim();
    if (item && !seen.has(item.toLowerCase()) && !isPlaceholder(policy, item)) {
      seen.add(item.toLowerCase());
      rows.push(item);
    }
  }
  return rows;
}

export function kvColumn(
  value: unknown,
  policy: ImportPolicy,
  label?: string,
): string[] {
  const text = cleanText(value, policy);
  if (!text || !label?.trim()) {
    return [];
  }
  return [`K: ${label.trim()} V: ${text}`];
}

export function kvLines(value: unknown, policy: ImportPolicy): string[] {
  const text = cleanText(value, policy);
  if (!text) {
    return [];
  }
  const rows: string[] = [];
  for (const line of text.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (/^K:\s*.+\s+V:\s*.+$/i.test(trimmed)) {
      rows.push(trimmed.replace(/^k:/i, "K:").replace(/\sv:/i, " V:"));
      continue;
    }
    const colon = trimmed.match(/^([^:]{1,80}):\s*(.+)$/);
    if (colon) {
      rows.push(`K: ${colon[1].trim()} V: ${colon[2].trim()}`);
    }
  }
  return rows;
}

export function impactStats(value: unknown, policy: ImportPolicy): string[] {
  const text = cleanText(value, policy);
  if (!text) {
    return [];
  }
  const rows: string[] = [];
  const pct = text.match(/(\d{1,3})\s*%/);
  if (pct) {
    let label = "of this purchase goes directly to the artisan family";
    if (text.toLowerCase().includes("community")) {
      label = "of this purchase goes directly to the artisan community";
    }
    rows.push(`V: ${pct[1]}% K: ${label}`);
  }
  const days = text.match(/(\d{1,2}[-–]\d{1,2}|\d{1,2})\s*days?/i);
  if (days) {
    rows.push(`V: ${days[1]} days K: Hand-crafted with care`);
  }
  return rows;
}

export function faqColumns(value: unknown, policy: ImportPolicy): string[] {
  const text = cleanText(value, policy);
  if (!text) {
    return [];
  }
  const rows: string[] = [];
  for (const line of text.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.includes("|")) {
      rows.push(trimmed);
      continue;
    }
    const qa = trimmed.match(/^(.+?)\s*[|:]\s*(.+)$/);
    if (qa) {
      rows.push(`${qa[1].trim()} | ${qa[2].trim()}`);
    }
  }
  return rows;
}

export function saleFromList(
  value: unknown,
  policy: ImportPolicy,
  multiplier?: number,
): { price: string; compare_at: string } {
  const text = cleanText(value, policy).replace(/,/g, "");
  if (!text || !/^\d+(\.\d+)?$/.test(text)) {
    return { price: "", compare_at: "" };
  }
  const listPrice = Number.parseFloat(text);
  if (!Number.isFinite(listPrice) || listPrice <= 0) {
    return { price: "", compare_at: "" };
  }
  const factor = multiplier ?? policy.sale_price_multiplier ?? 1;
  const sale = Math.ceil(listPrice * factor);
  const compare = Math.ceil(listPrice);
  return { price: String(sale), compare_at: String(compare) };
}

export function storyMakerJson(
  value: unknown,
  policy: ImportPolicy,
): Record<string, unknown> {
  return buildMakerStoryJson(cleanText(value, policy));
}

export function storyProcessJson(
  value: unknown,
  policy: ImportPolicy,
): Record<string, unknown> {
  return buildProcessStoryJson(cleanText(value, policy));
}

export function storyHeritageJson(
  value: unknown,
  policy: ImportPolicy,
): Record<string, unknown> {
  return buildHeritageStoryJson(cleanText(value, policy));
}

export function storyStylingJson(
  value: unknown,
  policy: ImportPolicy,
): Record<string, unknown> {
  return buildStylingStoryJson(cleanText(value, policy));
}

export function serializeMetafieldValue(
  shopifyType: string,
  value: unknown,
): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (shopifyType === "json") {
    return JSON.stringify(value);
  }
  if (shopifyType === "list.single_line_text_field") {
    return JSON.stringify(Array.isArray(value) ? value : [String(value)]);
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
