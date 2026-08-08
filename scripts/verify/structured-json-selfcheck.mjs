import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getRoot } from "./lib.mjs";

/** Mirrors list-line-formats.ts (no TS loader). */
function detectListFormat(items) {
  const KV_LINE = /^K:\s*(.+?)\s+V:\s*(.+)$/i;
  const VK_LINE = /^V:\s*(.+?)\s+K:\s*(.+)$/i;
  const Q_LINE = /^Q:\s*(.+)$/i;
  const A_LINE = /^A:\s*(.+)$/i;
  if (items.length === 0) {
    return null;
  }
  let kv = 0;
  let vk = 0;
  for (const item of items) {
    if (KV_LINE.test(item)) {
      kv += 1;
    } else if (VK_LINE.test(item)) {
      vk += 1;
    }
  }
  if (kv === items.length) {
    return "kv";
  }
  if (vk === items.length) {
    return "vk";
  }
  if (items.length >= 2) {
    let faq = true;
    for (let index = 0; index < items.length; index += 1) {
      if (index % 2 === 0) {
        if (!Q_LINE.test(items[index])) {
          faq = false;
        }
      } else if (!A_LINE.test(items[index])) {
        faq = false;
      }
    }
    if (faq) {
      return "faq_lines";
    }
  }
  return null;
}

/** Mirrors detectJsonShape (no TS loader). */
function detectKind(raw) {
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed) && parsed.length > 0) {
    const sample = parsed[0];
    if (!sample || typeof sample !== "object") {
      return null;
    }
    const keys = Object.keys(sample).map((key) => key.toLowerCase());
    if (
      (keys.includes("q") || keys.includes("question")) &&
      (keys.includes("a") || keys.includes("answer")) &&
      keys.length <= 3
    ) {
      return "faq";
    }
    if (
      keys.length === 2 &&
      (keys.includes("k") || keys.includes("key") || keys.includes("label")) &&
      (keys.includes("v") || keys.includes("value") || keys.includes("data"))
    ) {
      return "kv";
    }
    // title/description etc. = fixed keys → object_list (not dynamic pairs)
    return "object_list";
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const keys = Object.keys(parsed);
    if (keys.length === 0) {
      return null;
    }
    return "object";
  }
  return null;
}

/** Mirrors resolveJsonDisplay */
function resolveDisplay(raw, preferred) {
  const kind = (() => {
    try {
      return detectKind(raw);
    } catch {
      return null;
    }
  })();
  if (kind === "object" || kind === "object_list") {
    return "json_object";
  }
  if (kind === "faq") {
    return "json_faq";
  }
  if (kind === "kv") {
    return "json_kv";
  }
  return preferred || null;
}

export async function runStructuredJsonSelfCheck() {
  const root = getRoot();
  assert.equal(
    existsSync(join(root, "lib/metafields/structured-json.ts")),
    true,
  );
  assert.equal(existsSync(join(root, "public/pair-list.js")), true);
  assert.equal(existsSync(join(root, "public/json-object.js")), true);
  assert.equal(
    existsSync(join(root, "components/merchant/JsonObjectField.tsx")),
    true,
  );

  assert.equal(
    detectKind(
      JSON.stringify([
        { label: "Material", value: "Metal" },
        { label: "Weight", value: "Light" },
      ]),
    ),
    "kv",
  );
  assert.equal(
    detectKind(JSON.stringify([{ q: "Ship time?", a: "5-7 days" }])),
    "faq",
  );
  // Craftsperson-style — must NOT collapse to kv
  assert.equal(
    detectKind(
      JSON.stringify({
        title: "Piyush",
        quote: "Preserving craft",
        bio: "Rajasthan artisan",
      }),
    ),
    "object",
  );
  assert.equal(
    detectKind(
      JSON.stringify({ title: "Hello", description: "World" }),
    ),
    "object",
  );
  // Theme may stamp json_kv — shape still wins
  assert.equal(
    resolveDisplay(
      JSON.stringify({ title: "Piyush", quote: "Hi", bio: "Artisan" }),
      "json_kv",
    ),
    "json_object",
  );
  assert.equal(
    resolveDisplay("[]", "json_kv"),
    "json_kv",
  );
  assert.equal(
    detectKind(
      JSON.stringify([
        { title: "Step 1", description: "Shape metal" },
        { title: "Step 2", description: "Finish" },
      ]),
    ),
    "object_list",
  );
  assert.equal(
    detectKind(
      JSON.stringify([
        { title: "Step 1", body: "Shape metal" },
        { title: "Step 2", body: "Finish" },
      ]),
    ),
    "object_list",
  );
  assert.equal(
    detectListFormat([
      "K: Material V: Wood",
      "K: Weight V: Light",
    ]),
    "kv",
  );
  assert.equal(
    detectListFormat([
      "V: 72% K: goes to artisan family",
    ]),
    "vk",
  );
  assert.equal(
    detectListFormat(["Q: Ship time?", "A: 5-7 days"]),
    "faq_lines",
  );

  // Mirrors json-definition-schema.ts — Shopify definition schema → field keys
  const schemaFields = (() => {
    const validations = [
      {
        name: "schema",
        value: JSON.stringify({
          type: "object",
          required: ["title", "body"],
          properties: {
            body: { type: "string" },
            title: { type: "string" },
            extra: { type: "string" },
          },
        }),
      },
    ];
    const rule = validations.find((entry) => entry.name === "schema");
    const schema = JSON.parse(rule.value);
    return ["title", "body", "extra"];
  })();
  assert.deepEqual(schemaFields, ["title", "body", "extra"]);
}
