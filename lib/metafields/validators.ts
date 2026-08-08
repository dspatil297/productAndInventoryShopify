import { z } from "zod";

const UNSUPPORTED_TYPES = new Set(["file_reference", "product_reference"]);

export function isUnsupportedMetafieldType(typeName: string): boolean {
  return UNSUPPORTED_TYPES.has(typeName);
}

/** Shopify list + json metafields store JSON-encoded values. */
export function metafieldValueIsJsonEncoded(typeName: string): boolean {
  return typeName === "json" || typeName.startsWith("list.");
}

/**
 * Plain text in list.* text fields → JSON array Shopify expects.
 * "Test" + list.single_line_text_field → ["Test"]
 * Objects in a list.single_line array get stringified (Shopify wants strings only).
 */
export function normalizeMetafieldValue(
  typeName: string,
  value: string,
): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (typeName === "list.single_line_text_field") {
    return normalizeListSingleLine(trimmed);
  }

  if (typeName === "list.multi_line_text_field") {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return JSON.stringify(
          parsed.map((item) =>
            typeof item === "string" ? item : JSON.stringify(item),
          ),
        );
      }
      return JSON.stringify([
        typeof parsed === "string" ? parsed : JSON.stringify(parsed),
      ]);
    } catch {
      const items = splitMerchantListItems(trimmed);
      return JSON.stringify(items.length > 0 ? items : [trimmed]);
    }
  }

  if (
    typeName === "list.number_integer" ||
    typeName === "list.number_decimal"
  ) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return trimmed;
      }
      return JSON.stringify([parsed]);
    } catch {
      const items = splitMerchantListItems(trimmed);
      if (items.length > 0) {
        const numbers = items.map((item) =>
          typeName === "list.number_integer"
            ? Number.parseInt(item, 10)
            : Number(item),
        );
        if (numbers.every((n) => Number.isFinite(n))) {
          return JSON.stringify(numbers);
        }
      }
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return JSON.stringify([
          typeName === "list.number_integer"
            ? Number.parseInt(trimmed, 10)
            : Number(trimmed),
        ]);
      }
    }
  }

  // Plain prose in json metafields → JSON string value ("hello")
  if (typeName === "json") {
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      return JSON.stringify(trimmed);
    }
  }

  if (typeName === "single_line_text_field") {
    return collapseToSingleLine(trimmed);
  }

  return trimmed;
}

function collapseToSingleLine(value: string): string {
  return value.replace(/[\r\n\u2028\u2029]+/g, " ").trim();
}

function splitMerchantListItems(trimmed: string): string[] {
  return trimmed
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeListSingleLine(trimmed: string): string {
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return JSON.stringify(
        parsed.map((item) => {
          if (typeof item === "string") {
            return collapseToSingleLine(item);
          }
          // Shopify list.single_line items must be strings, not objects
          return collapseToSingleLine(JSON.stringify(item));
        }),
      );
    }
    if (typeof parsed === "string") {
      return JSON.stringify([collapseToSingleLine(parsed)]);
    }
    return JSON.stringify([collapseToSingleLine(JSON.stringify(parsed))]);
  } catch {
    // Phase 10: "red, blue" → ["red","blue"] (not one blob tag)
    const items = splitMerchantListItems(trimmed);
    if (items.length > 1) {
      return JSON.stringify(items.map(collapseToSingleLine));
    }
    return JSON.stringify([collapseToSingleLine(trimmed)]);
  }
}

export function validateMetafieldValue(
  typeName: string,
  value: string,
): { ok: true } | { ok: false; message: string } {
  if (isUnsupportedMetafieldType(typeName)) {
    return { ok: false, message: "Editing not supported for this type yet" };
  }

  if (value.trim() === "") {
    return { ok: true };
  }

  const schema = schemaForMetafieldType(typeName);
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid value";
    return { ok: false, message };
  }

  return { ok: true };
}

function schemaForMetafieldType(typeName: string): z.ZodType<string> {
  switch (typeName) {
    case "number_integer":
      return z.string().regex(/^-?\d+$/, "Must be a whole number");
    case "number_decimal":
      return z.string().regex(/^-?\d+(\.\d+)?$/, "Must be a number");
    case "boolean":
      return z.enum(["true", "false"], { message: "Must be true or false" });
    case "url":
      return z.url({ message: "Must be a valid URL" });
    case "date":
      return z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
    case "color":
      return z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use #RRGGBB");
    case "json":
      return z.string().refine((raw) => {
        try {
          JSON.parse(raw);
          return true;
        } catch {
          return false;
        }
      }, 'Use plain text or valid JSON — leave blank to skip');
    default:
      if (typeName.startsWith("list.")) {
        return z.string().refine((raw) => {
          try {
            return Array.isArray(JSON.parse(raw));
          } catch {
            return false;
          }
        }, "List values could not be normalized");
      }
      return z.string();
  }
}
