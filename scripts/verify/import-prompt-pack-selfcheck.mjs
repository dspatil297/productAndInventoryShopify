import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getRoot } from "./lib.mjs";

const BASE_HEADERS = [
  "title",
  "handle",
  "description",
  "product_type",
  "vendor",
  "status",
  "price",
  "compare_at_price",
  "sku",
  "track_inventory",
  "inventory_qty",
  "location_id",
  "inventory_policy",
];

function hashDefs(defs) {
  const payload = defs.map((definition) => ({
    namespace: definition.namespace,
    key: definition.key,
    type: definition.type,
    name: definition.name,
  }));
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

function buildPack(defs) {
  const metafieldHeaders = defs.map(
    (definition) => `${definition.namespace}.${definition.key}`,
  );
  return {
    version: hashDefs(defs),
    headers: [...BASE_HEADERS, ...metafieldHeaders],
    fields: [],
  };
}

export async function runImportPromptPackSelfCheck() {
  const root = getRoot();
  assert.equal(existsSync(join(root, "lib/import/prompt-pack.ts")), true);

  const defs = [
    {
      namespace: "custom",
      key: "color",
      type: "single_line_text_field",
      name: "Color",
    },
  ];
  const pack = buildPack(defs);
  assert.ok(pack.headers.includes("custom.color"));
  assert.equal(pack.version.length, 16);
  assert.equal(buildPack(defs).version, pack.version);
}
