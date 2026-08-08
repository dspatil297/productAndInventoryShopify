import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { getRoot } from "./lib.mjs";

function parseExcelBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  const headers = raw[0].map((header, index) => header || `column_${index + 1}`);
  const rows = [];
  for (let index = 1; index < raw.length; index += 1) {
    const cells = raw[index].map((cell) => String(cell ?? "").trim());
    if (cells.every((cell) => !cell)) {
      continue;
    }
    rows.push(headers.map((_, columnIndex) => cells[columnIndex] ?? ""));
  }
  return { headers, rows };
}

export async function runExcelParseSelfCheck() {
  const root = getRoot();
  assert.equal(existsSync(join(root, "lib/import/excel-parse.ts")), true);

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Product Name", "Price"],
    ["Shirt", "19.99"],
    ["", ""],
    ["Hat", "9.50"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Products");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const table = parseExcelBuffer(buffer);
  assert.equal(table.headers[0], "Product Name");
  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[0][0], "Shirt");
}
