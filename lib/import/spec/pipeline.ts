import type { Shop } from "@/generated/prisma/client";
import type { ExcelTable } from "@/lib/import/excel-parse";
import {
  applyArthenicColumnProfile,
  assertMappingHasTitleColumn,
  detectArthenicTemplate,
  ensureCoreMappings,
} from "@/lib/import/spec/mapping-resolve";
import {
  heuristicMappingConfig,
  suggestMappingConfigWithAi,
} from "@/lib/import/spec/mapping-ai";
import { buildPreviewDiffs } from "@/lib/import/spec/preview-service";
import type {
  MappingConfig,
  PreviewRowDiff,
  ProductDraft,
  StoreProfile,
} from "@/lib/import/spec/types";
import { buildProductDrafts } from "@/lib/import/spec/transform-engine";
import { productImportHeaders } from "@/lib/csv/productImport";
import { rowsToImportCsv } from "@/lib/import/import-csv-rows";
import { readMetafieldDefinitionsFromConfig } from "@/lib/metafields/config";
import type { ShopConfig } from "@/generated/prisma/client";

export interface SpecPipelineResult {
  mapping: MappingConfig;
  mappingNotes: string;
  drafts: ProductDraft[];
  preview: PreviewRowDiff[];
  csv: string;
  rowCount: number;
  usedAiMapping: boolean;
}

export async function runSpecImportPipeline(input: {
  shop: Shop;
  shopConfig: ShopConfig | null;
  table: ExcelTable;
  profile: StoreProfile;
  systemPrompt?: string;
}): Promise<SpecPipelineResult> {
  const definitions = readMetafieldDefinitionsFromConfig(input.shopConfig);
  let mapping = heuristicMappingConfig(input.table, input.profile.schema);
  let usedAiMapping = false;
  let mappingNotes = "mapping: heuristic";

  try {
    mapping = await suggestMappingConfigWithAi({
      table: input.table,
      schema: input.profile.schema,
      policy: input.profile.import_policy,
      systemPrompt: input.systemPrompt ?? input.profile.system_prompt,
    });
    usedAiMapping = true;
    mappingNotes = "mapping: AI";
  } catch (error) {
    const reason =
      error instanceof Error ? error.message.slice(0, 120) : "AI unavailable";
    mappingNotes = `mapping: heuristic (${reason})`;
  }

  if (!usedAiMapping) {
    mapping = applyArthenicColumnProfile(input.table, mapping);
  }
  mapping = ensureCoreMappings(input.table, mapping);

  const arthenicTemplate = detectArthenicTemplate(input.table.headers);
  if (arthenicTemplate && !usedAiMapping) {
    mappingNotes = `${mappingNotes}; arthenic:${arthenicTemplate}`;
  }
  try {
    assertMappingHasTitleColumn(input.table, mapping);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "title column not resolved";
    mappingNotes = `${mappingNotes}; ${reason}`;
  }

  const rawDrafts = buildProductDrafts(
    input.table,
    mapping,
    input.profile.schema,
    input.profile.import_policy,
  );

  const { drafts, preview } = await buildPreviewDiffs(
    input.shop,
    rawDrafts,
    input.profile.import_policy,
    mapping,
  );

  const headers = productImportHeaders(definitions);
  const csvRows = drafts.map((draft) => {
    const row: Record<string, string> = Object.fromEntries(
      headers.map((header) => [header, ""]),
    );
    row.title = draft.title ?? "";
    row.handle = draft.handle;
    row.description = draft.body_html ?? "";
    row.template_suffix = draft.template_suffix ?? "";
    row.price = draft.variants[0]?.price ?? "";
    row.compare_at_price = draft.variants[0]?.compare_at_price ?? "";
    row.sku = draft.variants[0]?.sku ?? "";
    row.status = input.profile.import_policy.default_status;
    for (const metafield of draft.metafields) {
      const key = `${metafield.namespace}.${metafield.key}`;
      if (headers.includes(key)) {
        row[key] = String(metafield.value);
      }
    }
    return row;
  });

  return {
    mapping,
    mappingNotes,
    drafts,
    preview,
    csv: rowsToImportCsv(headers, csvRows),
    rowCount: drafts.length,
    usedAiMapping,
  };
}

export function previewToLegacyRows(
  preview: PreviewRowDiff[],
): Array<{
  index: number;
  title: string;
  handle: string;
  price: string;
  template_suffix: string;
  metafieldCount: number;
  warnings: string[];
  action: string;
}> {
  return preview.slice(0, 15).map((row, index) => ({
    index: index + 1,
    title: row.title?.new ?? row.title?.old ?? "",
    handle: row.handle,
    price: row.price?.new ?? row.price?.old ?? "",
    template_suffix: row.template_suffix?.new ?? row.template_suffix?.old ?? "",
    metafieldCount: row.metafieldChanges,
    warnings: [
      ...(row.errors ?? []),
      ...row.warnings,
      ...(row.metafieldDiffs?.map(
        (diff) => `${diff.key}: ${diff.old ? "merge" : "set"}`,
      ) ?? []),
    ],
    action: row.action,
  }));
}
