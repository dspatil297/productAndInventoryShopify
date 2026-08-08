/**
 * Multi-store JSON metafield shapes — detect from data, never hardcode one theme.
 * Preserves original property names on save.
 */

export type JsonShapeKind = "kv" | "faq" | "object" | "object_list";

export interface StructuredPair {
  left: string;
  right: string;
}

export interface JsonObjectShape {
  kind: "object";
  fields: string[];
  value: Record<string, string>;
}

export interface JsonObjectListShape {
  kind: "object_list";
  fields: string[];
  items: Record<string, string>[];
}

export interface JsonPairShape {
  kind: "kv" | "faq";
  leftKey: string;
  rightKey: string;
  pairs: StructuredPair[];
}

export type DetectedJsonShape =
  | JsonObjectShape
  | JsonObjectListShape
  | JsonPairShape;

const FAQ_LEFT = ["q", "question", "prompt"] as const;
const FAQ_RIGHT = ["a", "answer", "response"] as const;
// Dynamic label/value rows only — not fixed schema keys (title, name, heading…)
const KV_LEFT = ["k", "key", "label", "attribute"] as const;
const KV_RIGHT = ["v", "value", "data"] as const;

function lowerKeyMap(record: Record<string, unknown>): Map<string, string> {
  const map = new Map<string, string>();
  for (const key of Object.keys(record)) {
    map.set(key.toLowerCase(), key);
  }
  return map;
}

function pickKey(
  keyMap: Map<string, string>,
  candidates: readonly string[],
): string | null {
  for (const candidate of candidates) {
    const actual = keyMap.get(candidate);
    if (actual) {
      return actual;
    }
  }
  return null;
}

function stringifyField(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function flattenObject(record: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = stringifyField(value);
  }
  return out;
}

function collectFields(items: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  const fields: string[] = [];
  for (const item of items) {
    for (const key of Object.keys(item)) {
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      fields.push(key);
    }
  }
  return fields;
}

function tryPairShape(
  items: Record<string, unknown>[],
  leftCandidates: readonly string[],
  rightCandidates: readonly string[],
  kind: "kv" | "faq",
): JsonPairShape | null {
  const sample = items[0];
  const keyMap = lowerKeyMap(sample);
  const leftKey = pickKey(keyMap, leftCandidates);
  const rightKey = pickKey(keyMap, rightCandidates);

  // ponytail: only known pair column names (label/value, q/a) — not title/body etc.
  if (!leftKey || !rightKey) {
    return null;
  }

  const keyCount = Object.keys(sample).length;
  if (kind === "kv" && keyCount > 3) {
    return null;
  }
  if (kind === "faq" && keyCount > 3) {
    return null;
  }

  // Freeform objects (title + quote + bio) — not pairs
  if (
    kind === "kv" &&
    keyCount > 2 &&
    (keyMap.has("quote") || keyMap.has("bio") || keyMap.has("body"))
  ) {
    return null;
  }

  return {
    kind,
    leftKey,
    rightKey,
    pairs: items.map((item) => ({
      left: stringifyField(item[leftKey!]).trim(),
      right: stringifyField(item[rightKey!]).trim(),
    })),
  };
}

function parseJson(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

/**
 * Detect editable JSON shape from stored value (any store / any theme).
 */
export function detectJsonShape(raw: string): DetectedJsonShape | null {
  const parsed = parseJson(raw);
  if (parsed == null) {
    return null;
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return null;
    }
    if (parsed.every((item) => typeof item === "string")) {
      return null; // list → TagList / prose elsewhere
    }
    if (
      !parsed.every(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    ) {
      return null;
    }
    const items = parsed as Record<string, unknown>[];
    const faq = tryPairShape(items, FAQ_LEFT, FAQ_RIGHT, "faq");
    if (faq) {
      return faq;
    }
    const kv = tryPairShape(items, KV_LEFT, KV_RIGHT, "kv");
    if (kv) {
      return kv;
    }
    return {
      kind: "object_list",
      fields: collectFields(items),
      items: items.map((item) => flattenObject(item)),
    };
  }

  if (typeof parsed === "object" && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    const fields = Object.keys(record);
    if (fields.length === 0) {
      return null;
    }
    // Fixed keys on one object → labeled fields, never dynamic pair rows
    return {
      kind: "object",
      fields,
      value: flattenObject(record),
    };
  }

  return null;
}

/**
 * Theme slots often default to json_kv. Fixed-key objects must still win.
 * Empty value → keep preferred (kv/faq/object guess from theme/key).
 */
export function resolveJsonDisplay(
  raw: string,
  preferred?: "json_kv" | "json_faq" | "json_object" | null,
): "json_kv" | "json_faq" | "json_object" | null {
  const shape = detectJsonShape(raw);
  if (shape?.kind === "object" || shape?.kind === "object_list") {
    return "json_object";
  }
  if (shape?.kind === "faq") {
    return "json_faq";
  }
  if (shape?.kind === "kv") {
    return "json_kv";
  }
  if (
    preferred === "json_kv" ||
    preferred === "json_faq" ||
    preferred === "json_object"
  ) {
    return preferred;
  }
  return null;
}

export function encodeStructuredPairs(
  pairs: StructuredPair[],
  leftKey: string,
  rightKey: string,
): string {
  const cleaned = pairs
    .map((pair) => ({
      left: pair.left.trim(),
      right: pair.right.trim(),
    }))
    .filter((pair) => pair.left.length > 0 || pair.right.length > 0);

  if (cleaned.length === 0) {
    return "[]";
  }

  return JSON.stringify(
    cleaned.map((pair) => ({
      [leftKey]: pair.left,
      [rightKey]: pair.right,
    })),
  );
}

export function encodeJsonObject(value: Record<string, string>): string {
  const out: Record<string, string> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    out[key] = fieldValue;
  }
  return JSON.stringify(out);
}

export function encodeJsonObjectList(
  items: Record<string, string>[],
  fields: string[],
): string {
  return JSON.stringify(
    items.map((item) => {
      const row: Record<string, string> = {};
      for (const field of fields) {
        row[field] = item[field] ?? "";
      }
      return row;
    }),
  );
}

/** @deprecated use detectJsonShape */
export function detectStructuredPairKind(
  raw: string,
): "kv" | "faq" | null {
  const shape = detectJsonShape(raw);
  if (shape?.kind === "kv" || shape?.kind === "faq") {
    return shape.kind;
  }
  return null;
}

/** @deprecated use detectJsonShape */
export function isStructuredJsonMetafield(
  typeName: string,
  raw: string,
): "kv" | "faq" | null {
  if (typeName !== "json") {
    return null;
  }
  return detectStructuredPairKind(raw);
}

export function parseKvPairs(raw: string): {
  pairs: StructuredPair[];
  leftKey: string;
  rightKey: string;
} {
  const shape = detectJsonShape(raw);
  if (shape?.kind === "kv") {
    return {
      pairs: shape.pairs,
      leftKey: shape.leftKey,
      rightKey: shape.rightKey,
    };
  }
  return { pairs: [], leftKey: "k", rightKey: "v" };
}

export function parseFaqPairs(raw: string): {
  pairs: StructuredPair[];
  leftKey: string;
  rightKey: string;
} {
  const shape = detectJsonShape(raw);
  if (shape?.kind === "faq") {
    return {
      pairs: shape.pairs,
      leftKey: shape.leftKey,
      rightKey: shape.rightKey,
    };
  }
  return { pairs: [], leftKey: "q", rightKey: "a" };
}
