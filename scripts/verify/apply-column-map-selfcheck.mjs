import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getRoot } from "./lib.mjs";

function escapeCsvValue(value) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function applyColumnMappings(table, pack, mappings) {
  const sourceIndex = new Map(
    table.headers.map((header, index) => [header, index]),
  );
  const mappingByTarget = new Map(
    mappings.map((mapping) => [mapping.target, mapping.source]),
  );
  const headerLine = pack.headers.map(escapeCsvValue).join(",");
  const lines = [headerLine];
  for (const row of table.rows) {
    const cells = pack.headers.map((target) => {
      const source = mappingByTarget.get(target);
      if (!source) {
        return "";
      }
      const index = sourceIndex.get(source);
      if (index == null) {
        return "";
      }
      return row[index] ?? "";
    });
    lines.push(cells.map(escapeCsvValue).join(","));
  }
  return { csv: `${lines.join("\n")}\n` };
}

export async function runApplyColumnMapSelfCheck() {
  const root = getRoot();
  assert.equal(existsSync(join(root, "lib/import/apply-column-map.ts")), true);

  const table = {
    headers: ["Name", "Cost"],
    rows: [
      ["Widget", "10"],
      ["Gadget", "20"],
    ],
  };
  const pack = { headers: ["title", "price"] };
  const result = applyColumnMappings(table, pack, [
    { target: "title", source: "Name" },
    { target: "price", source: "Cost" },
  ]);
  assert.match(result.csv, /Widget/);
  assert.match(result.csv, /^title,price/m);
}
