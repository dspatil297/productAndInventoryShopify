import {
  AiImportMapError,
  heuristicColumnMappings,
  mapExcelColumnsWithAi,
} from "@/lib/import/ai-map-columns";
import { synthesizeImportRowsWithAi } from "@/lib/import/ai-transform-rows";
import type { ColumnMapping } from "@/lib/import/apply-column-map";
import { deterministicCleanRow } from "@/lib/import/deterministic-row-clean";
import type { ExcelTable } from "@/lib/import/excel-parse";
import {
  mappingSummary,
  rowsFromColumnMappings,
  rowsToImportCsv,
} from "@/lib/import/import-csv-rows";
import type { ImportPromptPack } from "@/lib/import/prompt-pack";

export interface ExcelImportPreviewRow {
  index: number;
  title: string;
  handle: string;
  price: string;
  template_suffix: string;
  metafieldCount: number;
  warnings: string[];
  action?: string;
}

export interface ExcelImportPipelineResult {
  csv: string;
  rowCount: number;
  mappings: ColumnMapping[];
  mappingNotes: string;
  usedAiTransform: boolean;
  usedAiMapping: boolean;
  previewRows: ExcelImportPreviewRow[];
}

function buildSynthesisInputs(
  table: ExcelTable,
  pack: ImportPromptPack,
  mappings: ColumnMapping[],
) {
  const partialRows = rowsFromColumnMappings(table, pack, mappings);
  return table.rows.map((row, index) => {
    const source: Record<string, string> = {};
    table.headers.forEach((header, columnIndex) => {
      source[header] = (row[columnIndex] ?? "").trim();
    });
    return {
      source,
      partial: partialRows[index] ?? {},
    };
  });
}

function countMappedColumns(mappings: ColumnMapping[]): number {
  return mappings.filter((mapping) => mapping.source).length;
}

function buildPreviewRows(
  rows: Record<string, string>[],
  pack: ImportPromptPack,
): ExcelImportPreviewRow[] {
  return rows.slice(0, 15).map((row, index) => {
    let metafieldCount = 0;
    for (const field of pack.fields) {
      if (field.kind === "metafield" && (row[field.header]?.trim() ?? "")) {
        metafieldCount += 1;
      }
    }
    const warnings: string[] = [];
    if (!row.title?.trim()) {
      warnings.push("missing title");
    }
    if (!row.price?.trim()) {
      warnings.push("missing price");
    }

    return {
      index: index + 1,
      title: row.title?.trim() ?? "",
      handle: row.handle?.trim() ?? "",
      price: row.price?.trim() ?? "",
      template_suffix: row.template_suffix?.trim() ?? "",
      metafieldCount,
      warnings,
    };
  });
}

async function resolveColumnMappings(
  table: ExcelTable,
  pack: ImportPromptPack,
  systemPrompt?: string,
): Promise<{ mappings: ColumnMapping[]; notes: string; usedAiMapping: boolean }> {
  let mappings: ColumnMapping[] = [];
  let usedAiMapping = false;
  let mapSource = "heuristic";

  try {
    mappings = await mapExcelColumnsWithAi(table, pack, systemPrompt);
    usedAiMapping = true;
    mapSource = "AI";
  } catch {
    mappings = heuristicColumnMappings(table, pack);
  }

  const titleMapped = mappings.some(
    (mapping) => mapping.target === "title" && mapping.source,
  );
  if (!titleMapped) {
    throw new AiImportMapError(
      "Could not map a title column — add a Product Name column or use template CSV",
    );
  }

  return {
    mappings,
    usedAiMapping,
    notes: `column map: ${mapSource} (${countMappedColumns(mappings)} cols)`,
  };
}

export async function runExcelImportPipeline(
  table: ExcelTable,
  pack: ImportPromptPack,
  systemPrompt?: string,
): Promise<ExcelImportPipelineResult> {
  const { mappings, notes: mapNotes, usedAiMapping } =
    await resolveColumnMappings(table, pack, systemPrompt);
  const synthesisInputs = buildSynthesisInputs(table, pack, mappings);

  let cleanedRows = synthesisInputs.map((input) =>
    deterministicCleanRow(input.partial, pack.fields),
  );

  let usedAiTransform = false;
  try {
    const synthesized = await synthesizeImportRowsWithAi(synthesisInputs, pack);
    cleanedRows = synthesized.map((row) =>
      deterministicCleanRow(row, pack.fields),
    );
    usedAiTransform = true;
  } catch {
    // ponytail: merged column map + deterministic clean only
  }

  const csv = rowsToImportCsv(pack.headers, cleanedRows);
  const transformNote = usedAiTransform
    ? "transform: AI synthesis"
    : "transform: deterministic";

  return {
    csv,
    rowCount: cleanedRows.length,
    mappings,
    mappingNotes: `${mapNotes}; ${transformNote}; ${mappingSummary(mappings)}`,
    usedAiTransform,
    usedAiMapping,
    previewRows: buildPreviewRows(cleanedRows, pack),
  };
}

/** ponytail: assert-based self-check */
export function runExcelPipelineSelfCheck(): void {
  const table = {
    sheetName: "Sheet1",
    headers: ["Product Name", "Theme", "MRP"],
    rows: [["Coat", "Ethnic Wear", "1000"]],
  };
  const pack = {
    version: "test",
    builtAt: new Date().toISOString(),
    headers: ["title", "template_suffix", "price"],
    fields: [
      { header: "title", kind: "base" as const, label: "t", hint: "" },
      { header: "template_suffix", kind: "base" as const, label: "t", hint: "" },
      { header: "price", kind: "base" as const, label: "p", hint: "" },
    ],
  };
  const mappings = heuristicColumnMappings(table, pack);
  const merged = mappings;
  const rows = rowsFromColumnMappings(table, pack, merged).map((row) =>
    deterministicCleanRow(row, pack.fields),
  );
  const csv = rowsToImportCsv(pack.headers, rows);
  if (!csv.includes("ethnic-wear")) {
    throw new Error("pipeline self-check failed");
  }
  if (merged.find((mapping) => mapping.target === "title")?.source !== "Product Name") {
    throw new Error("merge self-check failed");
  }
}
