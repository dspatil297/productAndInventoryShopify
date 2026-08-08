import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getRoot } from "./lib.mjs";

function heuristicColumnMappings(table, pack) {
  const normalize = (value) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const sourceByNorm = new Map(
    table.headers.map((header) => [normalize(header), header]),
  );
  const aliases = {
    title: ["title", "product name", "name", "product title", "item"],
    price: ["price", "variant price", "sale price", "mrp"],
  };
  return pack.headers.map((target) => {
    const candidates = aliases[target] ?? [target.replace(/_/g, " ")];
    for (const candidate of candidates) {
      const match = sourceByNorm.get(normalize(candidate));
      if (match) {
        return { target, source: match };
      }
    }
    return { target, source: null };
  });
}

export async function runAiMapHeuristicSelfCheck() {
  const root = getRoot();
  assert.equal(existsSync(join(root, "lib/import/ai-map-columns.ts")), true);

  const table = {
    headers: ["Product Name", "Sale Price"],
    rows: [["Coat", "99"]],
  };
  const pack = { headers: ["title", "price"] };
  const mappings = heuristicColumnMappings(table, pack);
  const titleMap = mappings.find((mapping) => mapping.target === "title");
  assert.equal(titleMap?.source, "Product Name");
}
