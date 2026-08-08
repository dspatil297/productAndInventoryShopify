import * as XLSX from "xlsx";

export interface ExcelTable {
  sheetName: string;
  headers: string[];
  rows: string[][];
}

function cellToString(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

export function parseExcelBuffer(buffer: Buffer): ExcelTable {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel file has no sheets");
  }

  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (raw.length === 0) {
    throw new Error("Excel sheet is empty");
  }

  const headerRow = (raw[0] ?? []).map(cellToString);
  const headerCounts = new Map<string, number>();
  const headers = headerRow.map((header, index) => {
    const base =
      header.replace(/\u00a0/g, " ").trim() || `column_${index + 1}`;
    const seen = (headerCounts.get(base) ?? 0) + 1;
    headerCounts.set(base, seen);
    return seen === 1 ? base : `${base} (${seen})`;
  });

  const rows: string[][] = [];
  for (let index = 1; index < raw.length; index += 1) {
    const cells = (raw[index] ?? []).map(cellToString);
    if (cells.every((cell) => !cell)) {
      continue;
    }
    const row = headers.map((_, columnIndex) => cells[columnIndex] ?? "");
    rows.push(row);
  }

  if (rows.length === 0) {
    throw new Error("Excel sheet has headers but no data rows");
  }

  return { sheetName, headers, rows };
}

export function sampleExcelRows(
  table: ExcelTable,
  maxRows = 3,
): Array<Record<string, string>> {
  return table.rows.slice(0, maxRows).map((row) => {
    const record: Record<string, string> = {};
    table.headers.forEach((header, index) => {
      const value = row[index] ?? "";
      record[header] = value.length > 120 ? `${value.slice(0, 117)}...` : value;
    });
    return record;
  });
}

/** ponytail: assert-based self-check */
export function runExcelParseSelfCheck(): void {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Product Name", "Price"],
    ["Shirt", "19.99"],
    ["", ""],
    ["Hat", "9.50"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Products");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const table = parseExcelBuffer(buffer);
  if (table.headers[0] !== "Product Name") {
    throw new Error("excel header parse failed");
  }
  if (table.rows.length !== 2) {
    throw new Error(`expected 2 data rows, got ${table.rows.length}`);
  }
  if (table.rows[0][0] !== "Shirt") {
    throw new Error("excel row parse failed");
  }
}
