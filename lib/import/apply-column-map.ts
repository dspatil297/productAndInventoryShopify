import type { ImportPromptPack } from "@/lib/import/prompt-pack";
import type { ExcelTable } from "@/lib/import/excel-parse";

export interface ColumnMapping {
  target: string;
  source: string | null;
}

export interface ColumnMapResult {
  mappings: ColumnMapping[];
  csv: string;
  rowCount: number;
}

function escapeCsvValue(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function applyColumnMappings(
  table: ExcelTable,
  pack: ImportPromptPack,
  mappings: ColumnMapping[],
): ColumnMapResult {
  const sourceIndex = new Map(
    table.headers.map((header, index) => [header, index]),
  );

  const mappingByTarget = new Map<string, string | null>();
  for (const mapping of mappings) {
    mappingByTarget.set(mapping.target, mapping.source);
  }

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

  return {
    mappings,
    csv: `${lines.join("\n")}\n`,
    rowCount: table.rows.length,
  };
}

/** ponytail: assert-based self-check */
export function runApplyColumnMapSelfCheck(): void {
  const table = {
    sheetName: "Sheet1",
    headers: ["Name", "Cost"],
    rows: [
      ["Widget", "10"],
      ["Gadget", "20"],
    ],
  };
  const pack = {
    version: "test",
    builtAt: new Date().toISOString(),
    headers: ["title", "price"],
    fields: [],
  };
  const result = applyColumnMappings(table, pack, [
    { target: "title", source: "Name" },
    { target: "price", source: "Cost" },
  ]);
  if (!result.csv.includes("Widget")) {
    throw new Error("mapped csv missing widget");
  }
  if (!result.csv.startsWith("title,price")) {
    throw new Error("mapped csv missing headers");
  }
}
