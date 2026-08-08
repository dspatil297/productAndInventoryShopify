/** Merchant-facing display helpers. Shopify JSON / list encoding stays server-side. */

export function isListMetafieldType(typeName: string): boolean {
  return typeName.startsWith("list.");
}

export function isJsonProseMetafieldType(typeName: string): boolean {
  return typeName === "json";
}

/** Parse Shopify list value or merchant CSV-ish text → tag items. */
export function parseListEditorItems(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (typeof item === "string") {
            return item.trim();
          }
          if (item == null) {
            return "";
          }
          return String(item).trim();
        })
        .filter((item) => item.length > 0);
    }
    if (typeof parsed === "string" && parsed.trim()) {
      return [parsed.trim()];
    }
  } catch {
    // merchant plain / CSV style
  }

  return trimmed
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/** Encode tags for form value / save path (normalizeMetafieldValue accepts JSON array). */
export function encodeListEditorItems(items: string[]): string {
  const cleaned = items.map((item) => item.trim()).filter((item) => item.length > 0);
  if (cleaned.length === 0) {
    return "";
  }
  return JSON.stringify(cleaned);
}

/**
 * Show json metafields as prose — never dump raw [{...}] for merchants.
 * Prefer PairListField for k/v and FAQ shapes (see structured-json.ts).
 */
export function decodeJsonProse(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === "string") {
      return parsed;
    }
    if (Array.isArray(parsed)) {
      if (parsed.every((item) => typeof item === "string")) {
        return parsed.map((item) => String(item).trim()).filter(Boolean).join(", ");
      }
      return parsed
        .map((item) => {
          if (typeof item === "string") {
            return item.trim();
          }
          if (item && typeof item === "object") {
            const record = item as Record<string, unknown>;
            const q =
              record.q ?? record.Q ?? record.question ?? record.Question;
            const a =
              record.a ?? record.A ?? record.answer ?? record.Answer;
            if (typeof q === "string" || typeof a === "string") {
              return `Q: ${String(q ?? "").trim()}\nA: ${String(a ?? "").trim()}`;
            }
            const k =
              record.k ??
              record.K ??
              record.key ??
              record.label ??
              record.name ??
              record.title;
            const v =
              record.v ??
              record.V ??
              record.value ??
              record.text ??
              record.description ??
              record.data;
            if (typeof k === "string" || typeof v === "string") {
              return `${String(k ?? "").trim()} — ${String(v ?? "").trim()}`;
            }
            const title =
              record.title ??
              record.heading ??
              record.heading_html ??
              record.name ??
              record.tag ??
              record.eyebrow;
            if (typeof title === "string" && title.trim()) {
              const desc = record.description;
              if (typeof desc === "string" && desc.trim()) {
                return `${title.trim()}: ${desc.trim()}`;
              }
              return title.trim();
            }
            return Object.entries(record)
              .map(([key, value]) => `${key}: ${String(value)}`)
              .join(", ");
          }
          return item == null ? "" : String(item);
        })
        .filter((line) => line.length > 0)
        .join("\n\n");
    }
    if (parsed && typeof parsed === "object") {
      return Object.entries(parsed as Record<string, unknown>)
        .map(([key, value]) => {
          if (typeof value === "string") {
            return `${key}: ${value}`;
          }
          return `${key}: ${JSON.stringify(value)}`;
        })
        .join("\n");
    }
    return String(parsed);
  } catch {
    return raw;
  }
}

export function metafieldImportHint(typeName: string): string {
  switch (typeName) {
    case "boolean":
      return "true / false (or yes / no)";
    case "date":
      return "YYYY-MM-DD";
    case "color":
      return "#RRGGBB";
    case "url":
      return "https://…";
    case "number_integer":
      return "whole number";
    case "number_decimal":
      return "number";
    case "json":
      return "plain text ok (saved as JSON string); or valid JSON object";
    case "list.single_line_text_field":
      return "comma-separated tags (e.g. red, blue) — not JSON";
    case "list.multi_line_text_field":
      return "one item per line, or comma-separated — not JSON";
    case "list.number_integer":
    case "list.number_decimal":
      return "comma-separated numbers (e.g. 1, 2, 3)";
    case "multi_line_text_field":
      return "multi-line text";
    case "single_line_text_field":
      return "single line text";
    default:
      if (typeName.startsWith("list.")) {
        return "comma-separated values — not JSON array syntax";
      }
      return "plain value";
  }
}

export function metafieldTypeLabel(typeName: string): string {
  switch (typeName) {
    case "boolean":
      return "Yes / No";
    case "color":
      return "Color";
    case "date":
      return "Date";
    case "json":
      return "Text / JSON";
    case "list.single_line_text_field":
      return "Tags";
    case "list.multi_line_text_field":
      return "List (lines)";
    default:
      if (typeName.startsWith("list.")) {
        return "List";
      }
      return typeName.replaceAll("_", " ");
  }
}
