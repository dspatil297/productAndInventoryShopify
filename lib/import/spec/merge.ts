import { cleanSpreadsheetText } from "@/lib/import/deterministic-row-clean";

function extractKvLines(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => cleanSpreadsheetText(String(item ?? ""))).filter(Boolean);
      }
    } catch {
      // fall through to line split
    }
  }
  return cleanSpreadsheetText(trimmed).split("\n");
}

export function parseKvMetafield(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of extractKvLines(text)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("K: ") || !trimmed.includes(" V: ")) {
      continue;
    }
    const afterKey = trimmed.slice(3);
    const splitIndex = afterKey.indexOf(" V: ");
    if (splitIndex < 0) {
      continue;
    }
    const key = afterKey.slice(0, splitIndex).trim();
    const value = afterKey.slice(splitIndex + 4).trim();
    if (key && value) {
      out[key] = value;
    }
  }
  return out;
}

export function formatKvMetafield(pairs: Record<string, string>): string {
  return Object.entries(pairs)
    .map(([key, value]) => `K: ${key} V: ${value}`)
    .join("\n");
}

export function mergeKv(oldValue: string, newValue: string): string {
  if (!newValue.trim()) {
    return oldValue;
  }
  const oldPairs = parseKvMetafield(oldValue);
  const newPairs = parseKvMetafield(newValue);
  if (Object.keys(newPairs).length === 0) {
    return oldValue;
  }
  const merged = { ...oldPairs };
  for (const [key, value] of Object.entries(newPairs)) {
    if (value.trim()) {
      merged[key] = value;
    }
  }
  const isJsonList =
    newValue.trim().startsWith("[") || oldValue.trim().startsWith("[");
  if (isJsonList) {
    return JSON.stringify(
      Object.entries(merged).map(([key, value]) => `K: ${key} V: ${value}`),
    );
  }
  return formatKvMetafield(merged);
}

export function mergeText(oldValue: string, newValue: string): string {
  const trimmed = newValue.trim();
  return trimmed ? trimmed : oldValue;
}

const FROZEN_DRAFT_FIELDS = new Set([
  "variant.sku",
  "variant.price",
  "variant.compare_at_price",
  "sku",
  "price",
  "compare_at_price",
]);

const FROZEN_POLICY_TO_DRAFT: Record<string, string[]> = {
  "Variant SKU": ["variant.sku", "sku"],
  "Variant Inventory Qty": [],
  "Image Src": [],
  "SEO Title": [],
  "SEO Description": [],
};

export function isFrozenDraftField(
  frozenFields: string[],
  field: string,
): boolean {
  if (FROZEN_DRAFT_FIELDS.has(field)) {
    return frozenFields.some((frozen) =>
      ["Variant SKU", "Variant Inventory Qty"].includes(frozen),
    );
  }
  for (const frozen of frozenFields) {
    const mapped = FROZEN_POLICY_TO_DRAFT[frozen];
    if (mapped?.includes(field)) {
      return true;
    }
  }
  return false;
}

/** ponytail: assert-based self-check */
export function runMergeSelfCheck(): void {
  const merged = mergeKv(
    "K: Fabric V: Silk\nK: Region V: Varanasi",
    "K: Fabric V: Cotton\nK: Finish V: Matte",
  );
  if (!merged.includes("K: Fabric V: Cotton")) {
    throw new Error("merge_kv failed to overwrite");
  }
  if (!merged.includes("K: Region V: Varanasi")) {
    throw new Error("merge_kv failed to keep old key");
  }
  if (!merged.includes("K: Finish V: Matte")) {
    throw new Error("merge_kv failed to add new key");
  }
}
