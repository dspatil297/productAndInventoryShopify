import {
  cleanSpreadsheetText,
  isPlaceholderValue,
  slugifyTemplateSuffix,
} from "@/lib/import/deterministic-row-clean";
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
  const days = text.match(/(\d{1,2}\s*[-–]\s*\d{1,2}|\d{1,2})\s*days?/i);
  if (days) {
    const dayVal = days[1].replace(/\s+/g, "");
    const lower = text.toLowerCase();
    let label = "of hand-work represented in this piece";
    if (lower.includes("stitch") || lower.includes("tailor")) {
      label = "of detailed stitching and finishing work per outfit";
    } else if (lower.includes("paint")) {
      label = "of detailed hand-painting work for this artwork";
    } else if (lower.includes("setting") || lower.includes("jewel")) {
      label = "of hand-setting work per piece";
    }
    rows.push(`V: ${dayVal} days K: ${label}`);
  }
  return rows;
}

export function impactNote(value: unknown, policy: ImportPolicy): string {
  const text = cleanText(value, policy);
  if (!text) {
    return "";
  }
  const parts = text
    .split(/(?:\n{2,}|\s*[•·]\s*)/)
    .map((part) => part.trim())
    .filter(Boolean);
  const longNarrative = parts.filter(
    (part) => part.length > 100 && !/^\d{1,3}\s*%/.test(part) && !/^\d{1,2}(?:-\d{1,2})?\s*days?/i.test(part),
  );
  if (longNarrative.length > 0) {
    return longNarrative.join(" ");
  }
  if (parts.length >= 3) {
    return parts[parts.length - 1] ?? "";
  }
  // Single paragraph starting with "60% ... . <narrative>" (e.g. Decor Artisan Impact)
  const strippedLead = text
    .replace(/^\d{1,3}\s*%[^.!?]*[.!?]\s*/, "")
    .replace(/^\d{1,2}(?:-\d{1,2})?\s*days?[^.!?]*[.!?]\s*/i, "")
    .trim();
  return strippedLead.length > 40 ? strippedLead : "";
}

function parseRunonFaqPairs(block: string): string[] {
  const rows: string[] = [];
  const matches = block.matchAll(/([^.?\n]+?\?)\s*([^?]+?)(?=\s+[A-Z][^?]*\?|$)/g);
  for (const match of matches) {
    const q = match[1]?.trim();
    const a = match[2]?.trim().replace(/\.$/, "");
    if (!q || !a) {
      continue;
    }
    rows.push(/^q:/i.test(q) ? q.replace(/^q:/i, "Q:") : `Q: ${q}`);
    rows.push(/^a:/i.test(a) ? a.replace(/^a:/i, "A:") : `A: ${a}`);
  }
  return rows;
}

export function faqColumns(value: unknown, policy: ImportPolicy): string[] {
  const text = cleanText(value, policy);
  if (!text) {
    return [];
  }

  const numberedItems = [
    ...text.matchAll(/FAQ\s*\d+\s*:\s*([\s\S]+?)(?=FAQ\s*\d+\s*:|$)/gi),
  ];
  if (numberedItems.length > 0) {
    const rows: string[] = [];
    for (const match of numberedItems) {
      const item = (match[1] ?? "").trim();
      const qIdx = item.indexOf("?");
      if (qIdx !== -1) {
        const q = item.slice(0, qIdx + 1).trim();
        const a = item.slice(qIdx + 1).trim();
        if (q) rows.push(`Q: ${q}`);
        if (a) rows.push(`A: ${a}`);
      }
    }
    if (rows.length > 0) {
      return rows;
    }
  }

  if (
    !/^Q:\s*/im.test(text) &&
    !text.includes("|") &&
    (text.match(/\?/g) ?? []).length === 1
  ) {
    const qIdx = text.indexOf("?");
    const q = text.slice(0, qIdx + 1).replace(/\s+/g, " ").trim();
    const a = text.slice(qIdx + 1).replace(/\s+/g, " ").trim();
    if (q && a) {
      return [`Q: ${q}`, `A: ${a}`];
    }
  }

  const rows: string[] = [];
  for (const line of text.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (/^Q:\s*/i.test(trimmed)) {
      rows.push(trimmed.replace(/^q:/i, "Q:"));
      continue;
    }
    if (/^A:\s*/i.test(trimmed)) {
      rows.push(trimmed.replace(/^a:/i, "A:"));
      continue;
    }
    if (trimmed.includes("|")) {
      const [q, ...rest] = trimmed.split("|");
      const a = rest.join("|").trim();
      if (q.trim() && a) {
        rows.push(`Q: ${q.trim()}`);
        rows.push(`A: ${a}`);
      }
      continue;
    }
    const questionCount = (trimmed.match(/\?/g) ?? []).length;
    if (questionCount > 1) {
      rows.push(...parseRunonFaqPairs(trimmed));
      continue;
    }
    const qIdx = trimmed.indexOf("?");
    if (qIdx !== -1) {
      const q = trimmed.slice(0, qIdx + 1).trim();
      const a = trimmed.slice(qIdx + 1).trim();
      if (q) rows.push(`Q: ${q}`);
      if (a) rows.push(`A: ${a}`);
      continue;
    }
    const qa = trimmed.match(/^(.+?)\s*:\s*(.+)$/);
    if (qa) {
      rows.push(`Q: ${qa[1].trim()}`);
      rows.push(`A: ${qa[2].trim()}`);
    }
  }
  return rows;
}

export function dimensionsBlock(
  value: unknown,
  policy: ImportPolicy,
  part?: "measurements" | "highlight" | "note",
): string[] | string {
  const text = cleanText(value, policy);
  if (!text) {
    return part === "highlight" || part === "note" ? "" : [];
  }

  if (part === "highlight") {
    const match = text.match(/scale reference:\s*([^\n]+(?:\n(?!also (?:suitable|available))[^\n]+)*)/i);
    if (!match) {
      return "";
    }
    const raw = match[1].trim();
    const cut = raw.search(/also (?:suitable|available)/i);
    return (cut >= 0 ? raw.slice(0, cut) : raw).trim();
  }

  if (part === "note") {
    const match = text.match(/(also (?:suitable|available)[\s\S]+)$/i);
    return match ? match[1].trim() : "";
  }

  const firstBlock = text.split(/\n{2,}/)[0] ?? text;
  const beforeScale = firstBlock.split(/scale reference:/i)[0]?.trim() ?? firstBlock;
  const rows: string[] = [];

  const labeledMatches = [
    ...beforeScale.matchAll(
      /(?:^|[•·,|]\s*)([~≈]?\d+(?:\.\d+)?\s*(?:inch(?:es)?|in|cm|mm|g|kg))\s+(Length|Width|Height|Diameter|Depth|Weight)\b/gi,
    ),
  ];
  if (labeledMatches.length > 0) {
    for (const match of labeledMatches) {
      const val = match[1].trim();
      const rawLabel = match[2].trim();
      const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1).toLowerCase();
      rows.push(`K: ${label} V: ${val}`);
    }
    return rows;
  }

  const cross = beforeScale.match(
    /(\d+(?:\.\d+)?)\s*(?:inch(?:es)?|in|cm|mm)?\s*[×x]\s*(\d+(?:\.\d+)?)\s*(?:inch(?:es)?|in|cm|mm)?(?:\s*[×x]\s*(\d+(?:\.\d+)?)\s*(?:inch(?:es)?|in|cm|mm)?)?(?:\s*(inch(?:es)?|in|cm|mm))?/i,
  );
  if (cross) {
    const unitMatch = beforeScale.match(/\b(inches|inch|in|cm|mm)\b/i);
    const rawUnit = (cross[4] ?? unitMatch?.[1] ?? "in").toLowerCase();
    const unit = rawUnit.startsWith("inch") ? "in" : rawUnit;
    if (cross[3]) {
      rows.push(`K: Length V: ${cross[1]} ${unit}`);
      rows.push(`K: Width V: ${cross[2]} ${unit}`);
      rows.push(`K: Height V: ${cross[3]} ${unit}`);
    } else {
      rows.push(`K: Width V: ${cross[1]} ${unit}`);
      rows.push(`K: Height V: ${cross[2]} ${unit}`);
    }
    const weight = beforeScale.match(/([~≈]?\d+(?:\.\d+)?\s*(?:g|kg))\b/i);
    if (weight) {
      rows.push(`K: Weight V: ${weight[1].trim()}`);
    }
    return rows;
  }

  if (beforeScale) {
    rows.push(`K: Dimensions V: ${beforeScale}`);
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
    if (typeof value === "string" && !value.trim()) {
      return "";
    }
    return JSON.stringify(value);
  }
  if (shopifyType.startsWith("list.")) {
    const items = Array.isArray(value)
      ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
      : String(value)
          .trim()
          ? [String(value).trim()]
          : [];
    return items.length > 0 ? JSON.stringify(items) : "";
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item ?? "").trim()).filter(Boolean);
    return items.length > 0 ? JSON.stringify(items) : "";
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0 ? JSON.stringify(value) : "";
  }
  return String(value).trim();
}
