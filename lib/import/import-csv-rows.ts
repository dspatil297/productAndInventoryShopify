import type { ColumnMapping } from "@/lib/import/apply-column-map";
import type { ExcelTable } from "@/lib/import/excel-parse";
import type { ImportPromptPack } from "@/lib/import/prompt-pack";

function escapeCsvValue(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function rowsFromColumnMappings(
  table: ExcelTable,
  pack: ImportPromptPack,
  mappings: ColumnMapping[],
): Record<string, string>[] {
  const sourceIndex = new Map(
    table.headers.map((header, index) => [header, index]),
  );
  const mappingByTarget = new Map(
    mappings.map((mapping) => [mapping.target, mapping.source]),
  );

  return table.rows.map((row) => {
    const record: Record<string, string> = {};
    for (const target of pack.headers) {
      const source = mappingByTarget.get(target);
      if (!source) {
        record[target] = "";
        continue;
      }
      const index = sourceIndex.get(source);
      record[target] = index == null ? "" : (row[index] ?? "").trim();
    }
    return record;
  });
}

export function rowsToImportCsv(
  headers: string[],
  rows: Record<string, string>[],
): string {
  const lines = [headers.map(escapeCsvValue).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvValue(row[header] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function mergeColumnMappings(
  primary: ColumnMapping[],
  fallback: ColumnMapping[],
): ColumnMapping[] {
  const fallbackByTarget = new Map(
    fallback.map((mapping) => [mapping.target, mapping.source]),
  );
  return primary.map((mapping) => ({
    target: mapping.target,
    source: mapping.source ?? fallbackByTarget.get(mapping.target) ?? null,
  }));
}

export function mappingSummary(mappings: ColumnMapping[]): string {
  return mappings
    .filter((mapping) => mapping.source)
    .map((mapping) => `${mapping.source} -> ${mapping.target}`)
    .join("; ");
}
