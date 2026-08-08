/**
 * Mirrors lib/metafields/display.ts + validators normalize critical cases.
 * Keep in sync when changing list/json normalize.
 */

function parseListEditorItems(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === "string" ? item.trim() : String(item).trim()))
        .filter((item) => item.length > 0);
    }
  } catch {
    // fall through
  }
  return trimmed
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function encodeListEditorItems(items) {
  const cleaned = items.map((item) => item.trim()).filter((item) => item.length > 0);
  if (cleaned.length === 0) {
    return "";
  }
  return JSON.stringify(cleaned);
}

function splitMerchantListItems(trimmed) {
  return trimmed
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function collapseToSingleLine(value) {
  return value.replace(/[\r\n\u2028\u2029]+/g, " ").trim();
}

function normalizeListSingleLine(trimmed) {
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return JSON.stringify(
        parsed.map((item) =>
          typeof item === "string"
            ? collapseToSingleLine(item)
            : collapseToSingleLine(JSON.stringify(item)),
        ),
      );
    }
    if (typeof parsed === "string") {
      return JSON.stringify([collapseToSingleLine(parsed)]);
    }
    return JSON.stringify([collapseToSingleLine(JSON.stringify(parsed))]);
  } catch {
    const items = splitMerchantListItems(trimmed);
    if (items.length > 1) {
      return JSON.stringify(items.map(collapseToSingleLine));
    }
    return JSON.stringify([collapseToSingleLine(trimmed)]);
  }
}

function normalizeMetafieldValue(typeName, value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (typeName === "list.single_line_text_field") {
    return normalizeListSingleLine(trimmed);
  }
  if (typeName === "json") {
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      return JSON.stringify(trimmed);
    }
  }
  return trimmed;
}

function decodeJsonProse(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "string") {
      return parsed;
    }
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

export async function runMetafieldWidgetsSelfCheck() {
  const tags = parseListEditorItems('["red","blue"]');
  if (tags.join("|") !== "red|blue") {
    throw new Error(`parse list JSON failed: ${tags.join("|")}`);
  }

  const csvish = parseListEditorItems("red, blue, green");
  if (csvish.join("|") !== "red|blue|green") {
    throw new Error(`parse comma list failed: ${csvish.join("|")}`);
  }

  if (encodeListEditorItems(["a", "b"]) !== '["a","b"]') {
    throw new Error("encode list failed");
  }

  const normalized = normalizeMetafieldValue(
    "list.single_line_text_field",
    "red, blue",
  );
  if (normalized !== '["red","blue"]') {
    throw new Error(`normalize comma list failed: ${normalized}`);
  }

  const jsonProse = normalizeMetafieldValue("json", "hello");
  if (jsonProse !== '"hello"') {
    throw new Error(`json prose normalize failed: ${jsonProse}`);
  }

  if (decodeJsonProse('"hello"') !== "hello") {
    throw new Error("decodeJsonProse failed");
  }
}
