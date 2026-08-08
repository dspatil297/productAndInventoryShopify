import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getRoot } from "./lib.mjs";

function cleanSpreadsheetText(value) {
  return String(value).trim();
}

function slugifyTemplateSuffix(value) {
  return cleanSpreadsheetText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function heuristicColumnMappings(table, pack) {
  const normalize = (value) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const sourceByNorm = new Map(
    table.headers.map((header) => [normalize(header), header]),
  );
  const aliases = {
    title: ["title", "product name", "name"],
    template_suffix: ["theme", "template", "template suffix"],
    price: ["price", "mrp", "sale price"],
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

function rowsFromMappings(table, pack, mappings) {
  const sourceIndex = new Map(
    table.headers.map((header, index) => [header, index]),
  );
  const mappingByTarget = new Map(
    mappings.map((mapping) => [mapping.target, mapping.source]),
  );
  return table.rows.map((row) => {
    const record = {};
    for (const target of pack.headers) {
      const source = mappingByTarget.get(target);
      const index = source ? sourceIndex.get(source) : null;
      record[target] = index == null ? "" : String(row[index] ?? "").trim();
    }
    return record;
  });
}

export async function runExcelPipelineSelfCheck() {
  const root = getRoot();
  assert.equal(existsSync(join(root, "lib/import/excel-pipeline.ts")), true);

  const table = {
    headers: ["Product Name", "Theme", "MRP"],
    rows: [["Coat", "Ethnic Wear", "₹1,000"]],
  };
  const pack = {
    headers: ["title", "template_suffix", "price"],
    fields: [
      { header: "title", kind: "base" },
      { header: "template_suffix", kind: "base" },
      { header: "price", kind: "base" },
    ],
  };
  const mappings = heuristicColumnMappings(table, pack);
  const rows = rowsFromMappings(table, pack, mappings).map((row) => ({
    ...row,
    template_suffix: slugifyTemplateSuffix(row.template_suffix),
    price: row.price.replace(/[₹,\s]/g, ""),
  }));
  assert.equal(rows[0].template_suffix, "ethnic-wear");
  assert.equal(rows[0].price, "1000");
}
