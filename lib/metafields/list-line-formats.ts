/**
 * List metafields often store line-encoded pairs (any store / bulk import).
 * Arthenic ProductsUpload uses `K: label V: value` and `V: stat K: caption` lines.
 */

import { parseListEditorItems } from "@/lib/metafields/display";

export type ListLineFormat = "kv" | "vk" | "faq_lines";

const KV_LINE = /^K:\s*(.+?)\s+V:\s*(.+)$/i;
const VK_LINE = /^V:\s*(.+?)\s+K:\s*(.+)$/i;
const Q_LINE = /^Q:\s*(.+)$/i;
const A_LINE = /^A:\s*(.+)$/i;

export interface ListLinePair {
  left: string;
  right: string;
}

/** Detect line pattern in a list.single_line_text_field value. */
export function detectListLineFormat(items: string[]): ListLineFormat | null {
  if (items.length === 0) {
    return null;
  }

  let kvCount = 0;
  let vkCount = 0;
  for (const item of items) {
    if (KV_LINE.test(item)) {
      kvCount += 1;
    } else if (VK_LINE.test(item)) {
      vkCount += 1;
    }
  }
  if (kvCount === items.length) {
    return "kv";
  }
  if (vkCount === items.length) {
    return "vk";
  }
  if (kvCount > 0 && kvCount >= Math.ceil(items.length * 0.8)) {
    return "kv";
  }

  if (items.length >= 2) {
    let isFaq = true;
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (index % 2 === 0) {
        if (!Q_LINE.test(item)) {
          isFaq = false;
          break;
        }
      } else if (!A_LINE.test(item)) {
        isFaq = false;
        break;
      }
    }
    if (isFaq) {
      return "faq_lines";
    }
  }

  return null;
}

export function detectListLineFormatFromRaw(raw: string): ListLineFormat | null {
  const items = parseListEditorItems(raw);
  return detectListLineFormat(items);
}

export function listItemsToPairs(
  items: string[],
  format: ListLineFormat,
): ListLinePair[] {
  if (format === "kv") {
    return items
      .map((item) => {
        const match = item.match(KV_LINE);
        if (!match) {
          return null;
        }
        return { left: match[1].trim(), right: match[2].trim() };
      })
      .filter((pair): pair is ListLinePair => pair !== null);
  }

  if (format === "vk") {
    return items
      .map((item) => {
        const match = item.match(VK_LINE);
        if (!match) {
          return null;
        }
        return { left: match[1].trim(), right: match[2].trim() };
      })
      .filter((pair): pair is ListLinePair => pair !== null);
  }

  const pairs: ListLinePair[] = [];
  for (let index = 0; index < items.length; index += 2) {
    const qMatch = items[index]?.match(Q_LINE);
    const aMatch = items[index + 1]?.match(A_LINE);
    if (!qMatch) {
      continue;
    }
    pairs.push({
      left: qMatch[1].trim(),
      right: aMatch ? aMatch[1].trim() : "",
    });
  }
  return pairs;
}

export function pairsToListItems(
  pairs: ListLinePair[],
  format: ListLineFormat,
): string[] {
  const cleaned = pairs
    .map((pair) => ({
      left: pair.left.trim(),
      right: pair.right.trim(),
    }))
    .filter((pair) => pair.left.length > 0 || pair.right.length > 0);

  if (format === "kv") {
    return cleaned.map((pair) => `K: ${pair.left} V: ${pair.right}`);
  }
  if (format === "vk") {
    return cleaned.map((pair) => `V: ${pair.left} K: ${pair.right}`);
  }
  const lines: string[] = [];
  for (const pair of cleaned) {
    lines.push(`Q: ${pair.left}`);
    if (pair.right) {
      lines.push(`A: ${pair.right}`);
    }
  }
  return lines;
}

export function listValueToPairJson(
  raw: string,
): {
  hiddenValue: string;
  format: ListLineFormat;
  mode: "kv" | "faq" | "vk";
  storage: "json" | "list_lines";
} | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (
        parsed.every(
          (item) => item && typeof item === "object" && !Array.isArray(item),
        )
      ) {
        const sample = parsed[0] as Record<string, unknown>;
        const keys = Object.keys(sample).map((key) => key.toLowerCase());
        const isFaq =
          (keys.includes("q") || keys.includes("question")) &&
          (keys.includes("a") || keys.includes("answer"));
        const isKv =
          (keys.includes("k") ||
            keys.includes("key") ||
            keys.includes("label")) &&
          (keys.includes("v") || keys.includes("value") || keys.includes("data"));
        if (isFaq) {
          return {
            format: "faq_lines",
            mode: "faq",
            storage: "json",
            hiddenValue: trimmed,
          };
        }
        if (isKv) {
          return {
            format: "kv",
            mode: "kv",
            storage: "json",
            hiddenValue: trimmed,
          };
        }
      }
      if (parsed.every((item) => typeof item === "string")) {
        const format = detectListLineFormat(parsed);
        if (format) {
          const mode =
            format === "faq_lines" ? "faq" : format === "vk" ? "vk" : "kv";
          return {
            format,
            mode,
            storage: "list_lines",
            hiddenValue: trimmed,
          };
        }
      }
    }
  } catch {
    // plain / newline text below
  }

  const items = parseListEditorItems(raw);
  const format = detectListLineFormat(items);
  if (!format) {
    return null;
  }
  const mode = format === "faq_lines" ? "faq" : format === "vk" ? "vk" : "kv";
  return {
    format,
    mode,
    storage: "list_lines",
    hiddenValue: JSON.stringify(items),
  };
}

export function pairJsonToListValue(
  pairJson: string,
  format: ListLineFormat,
): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(pairJson.trim() || "[]");
  } catch {
    return "[]";
  }
  if (!Array.isArray(parsed)) {
    return "[]";
  }

  const pairs: ListLinePair[] = parsed
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const record = item as Record<string, unknown>;
      const left =
        record.q ??
        record.question ??
        record.k ??
        record.key ??
        record.label ??
        record.name;
      const right =
        record.a ??
        record.answer ??
        record.v ??
        record.value ??
        record.text ??
        record.data;
      return {
        left: left == null ? "" : String(left).trim(),
        right: right == null ? "" : String(right).trim(),
      };
    })
    .filter((pair): pair is ListLinePair => pair !== null);

  return JSON.stringify(pairsToListItems(pairs, format));
}
