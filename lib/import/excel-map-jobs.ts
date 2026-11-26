import { randomUUID } from "node:crypto";
import { getShopWithConfig } from "@/lib/db/shops";
import { parseExcelBuffer } from "@/lib/import/excel-parse";
import type { ExcelImportPreviewRow } from "@/lib/import/excel-pipeline";
import type { ImportPromptPack } from "@/lib/import/prompt-pack";
import {
  getImportSession,
  loadImportSessionDrafts,
  saveImportSession,
  type StoredImportSessionStatus,
} from "@/lib/import/spec/import-sessions";
import { runImportWorker } from "@/lib/import/spec/import-worker";
import {
  previewToLegacyRows,
  runSpecImportPipeline,
} from "@/lib/import/spec/pipeline";
import { readStoreProfile } from "@/lib/import/spec/store-profile";
import type { ImportReport, ProductDraft } from "@/lib/import/spec/types";
import { upsertStoreProfileForShop } from "@/lib/import/spec/store-profile";
import { readMetafieldDefinitionsFromConfig } from "@/lib/metafields/config";

export type ExcelMapJobStatus =
  | "queued"
  | "processing"
  | "preview_ready"
  | "importing"
  | "done"
  | "error";

export interface ExcelMapJobPublic {
  id: string;
  status: ExcelMapJobStatus;
  error?: string;
  mappingNotes?: string;
  rowCount?: number;
  previewRows?: ExcelImportPreviewRow[];
  mappedColumnCount?: number;
  previewSummary?: { create: number; update: number; skip: number; error: number };
  canResume?: boolean;
  resumeFromHandle?: string;
  flash?: Record<string, string>;
  downloadReady: boolean;
  importDone: boolean;
}

interface ExcelMapJobRecord {
  id: string;
  shopId: string;
  buffer: Buffer;
  fileName: string;
  pack: ImportPromptPack;
  systemPrompt?: string;
  status: ExcelMapJobStatus;
  createdAt: number;
  error?: string;
  mappingNotes?: string;
  rowCount?: number;
  previewRows?: ExcelImportPreviewRow[];
  previewSummary?: ExcelMapJobPublic["previewSummary"];
  mappedColumnCount?: number;
  csv?: string;
  drafts?: ProductDraft[];
  report?: ImportReport;
  resumeFromHandle?: string;
  flash?: Record<string, string>;
}

const JOB_TTL_MS = 60 * 60 * 1000;
const PREVIEW_STALE_MS = 60 * 1000;
const PREVIEW_TIMEOUT_MS = 30 * 1000;

// ponytail: in-memory buffer cache; session drafts persisted in ShopConfig
const jobs = new Map<string, ExcelMapJobRecord>();

async function persistJobSnapshot(
  job: ExcelMapJobRecord,
  status: StoredImportSessionStatus,
  extra?: {
    error?: string;
    resumeFromHandle?: string;
    report?: ImportReport;
  },
): Promise<void> {
  await saveImportSession(job.shopId, {
    id: job.id,
    shopId: job.shopId,
    fileName: job.fileName,
    status,
    createdAt: new Date(job.createdAt).toISOString(),
    updatedAt: new Date().toISOString(),
    mappingNotes: job.mappingNotes,
    rowCount: job.rowCount,
    previewSummary: job.previewSummary,
    previewRows: job.previewRows,
    drafts: job.drafts,
    csv: job.csv,
    report: extra?.report ?? job.report,
    resumeFromHandle: extra?.resumeFromHandle ?? job.resumeFromHandle,
    error: extra?.error ?? job.error,
  });
}

function markStalePreviewJob(job: ExcelMapJobRecord): boolean {
  if (job.status !== "queued" && job.status !== "processing") {
    return false;
  }
  if (Date.now() - job.createdAt <= PREVIEW_STALE_MS) {
    return false;
  }
  job.status = "error";
  job.error = "Preview timed out — upload Excel again";
  return true;
}

function pruneOldJobs(): void {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs.entries()) {
    if (job.createdAt < cutoff) {
      jobs.delete(id);
    }
  }
}

export function startExcelMapJob(input: {
  shopId: string;
  buffer: Buffer;
  fileName: string;
  pack: ImportPromptPack;
  systemPrompt?: string;
}): string {
  const id = randomUUID();
  jobs.set(id, {
    id,
    shopId: input.shopId,
    buffer: input.buffer,
    fileName: input.fileName,
    pack: input.pack,
    systemPrompt: input.systemPrompt,
    status: "queued",
    createdAt: Date.now(),
  });
  void processExcelMapPreview(id);
  pruneOldJobs();
  return id;
}

async function processExcelMapPreview(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) {
    return;
  }

  job.status = "processing";
  void persistJobSnapshot(job, "processing");

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error("Preview timed out — try a smaller file or try again"));
    }, PREVIEW_TIMEOUT_MS);
  });

  try {
    await Promise.race([runExcelMapPreviewWork(job), timeout]);
  } catch (error) {
    job.status = "error";
    job.error = error instanceof Error ? error.message : "Excel preview failed";
    await persistJobSnapshot(job, "failed", { error: job.error });
  }
}

async function runExcelMapPreviewWork(job: ExcelMapJobRecord): Promise<void> {
  try {
    const shop = await getShopWithConfig(job.shopId);
    if (!shop) {
      throw new Error("Store not found");
    }

    const definitions = readMetafieldDefinitionsFromConfig(shop.config);
    let profile = readStoreProfile(shop.config?.settings);
    const profileAgeMs = profile?.updated_at
      ? Date.now() - Date.parse(profile.updated_at)
      : Number.POSITIVE_INFINITY;
    const hasEnrichedSchema = Boolean(
      profile &&
        profileAgeMs < 30 * 60 * 1000 &&
        profile.schema.metafields.some(
          (m) =>
            (m.liquid_hints?.length ?? 0) > 0 ||
            (m.sample_values?.length ?? 0) > 0,
        ),
    );
    if (!profile || !hasEnrichedSchema) {
      profile = await upsertStoreProfileForShop({
        shopId: shop.id,
        shopDomain: shop.shopDomain,
        definitions,
        shop,
        systemPrompt: job.systemPrompt ?? profile?.system_prompt,
      });
    }

    const table = parseExcelBuffer(job.buffer);
    const pipeline = await runSpecImportPipeline({
      shop,
      shopConfig: shop.config,
      table,
      profile: {
        ...profile,
        system_prompt: job.systemPrompt ?? profile.system_prompt,
      },
      systemPrompt: job.systemPrompt,
    });

    job.mappingNotes = pipeline.mappingNotes;
    job.csv = pipeline.csv;
    job.rowCount = pipeline.rowCount;
    job.drafts = pipeline.drafts;
    job.previewRows = previewToLegacyRows(pipeline.preview);
    job.previewSummary = {
      create: pipeline.preview.filter((row) => row.action === "create").length,
      update: pipeline.preview.filter((row) => row.action === "update").length,
      skip: pipeline.preview.filter((row) => row.action === "skip").length,
      error: pipeline.preview.filter((row) => row.action === "error").length,
    };
    job.mappedColumnCount = Object.keys(pipeline.mapping.column_map).length;
    job.status = "preview_ready";

    await persistJobSnapshot(job, "preview_ready");
  } catch (error) {
    job.status = "error";
    job.error = error instanceof Error ? error.message : "Excel preview failed";
    await persistJobSnapshot(job, "failed", { error: job.error });
    throw error;
  }
}

export async function confirmExcelMapImport(
  jobId: string,
  shopId: string,
  options?: { resumeFromHandle?: string },
): Promise<ExcelMapJobPublic> {
  let job = jobs.get(jobId);
  if (!job || job.shopId !== shopId) {
    const stored = await getImportSession(shopId, jobId);
    if (!stored) {
      throw new Error("Preview session expired or not found — click Generate preview again");
    }
    job = {
      id: stored.id,
      shopId: stored.shopId,
      buffer: Buffer.alloc(0),
      fileName: stored.fileName,
      pack: { version: "", builtAt: "", headers: [], fields: [] },
      status: storedStatusToJobStatus(
        stored.status,
        stored.resumeFromHandle,
        stored.updatedAt,
      ),
      createdAt: Date.parse(stored.createdAt),
      mappingNotes: stored.mappingNotes,
      rowCount: stored.rowCount,
      previewSummary: stored.previewSummary,
      previewRows: stored.previewRows,
      drafts: stored.drafts,
      csv: stored.csv,
      report: stored.report,
      resumeFromHandle: stored.resumeFromHandle,
    };
    jobs.set(jobId, job);
  }

  if (!job.drafts || job.drafts.length === 0) {
    const loaded = await loadImportSessionDrafts(
      shopId,
      jobId,
      options?.resumeFromHandle ?? job.resumeFromHandle,
    );
    if (loaded) {
      job.drafts = loaded.drafts;
      job.resumeFromHandle = loaded.resumeFromHandle;
    }
  }

  if ((job.status !== "preview_ready" && job.status !== "error") || !job.drafts) {
    throw new Error("Preview not ready — generate preview first");
  }

  job.status = "importing";

  try {
    const shop = await getShopWithConfig(job.shopId);
    if (!shop) {
      throw new Error("Store not found");
    }

    const report = await runImportWorker(
      shop,
      job.id,
      job.drafts,
      options?.resumeFromHandle ?? job.resumeFromHandle,
    );
    job.report = report;
    job.resumeFromHandle = report.resume_from_handle;

    const imported = report.summary.created + report.summary.updated;

    if (report.summary.failed > 0) {
      const failedEntry = report.handles.find(
        (entry) => entry.status === "failed",
      );
      const failureDetail = failedEntry?.errors?.length
        ? `: ${failedEntry.errors.join("; ")}`
        : "";
      job.flash = {
        saved: String(imported),
        error: `${report.summary.failed} row(s) failed at ${report.resume_from_handle ?? "unknown"}${failureDetail}`,
      };
      job.status = imported > 0 ? "done" : "error";
      if (job.status === "error") {
        job.error = job.flash.error;
      }
      await saveImportSession(job.shopId, {
        id: job.id,
        shopId: job.shopId,
        fileName: job.fileName,
        status: "failed",
        createdAt: new Date(job.createdAt).toISOString(),
        updatedAt: new Date().toISOString(),
        mappingNotes: job.mappingNotes,
        rowCount: job.rowCount,
        previewSummary: job.previewSummary,
        drafts: job.drafts,
        csv: job.csv,
        report,
        resumeFromHandle: report.resume_from_handle,
        error: job.error,
      });
    } else {
      const handleWarnings = report.handles
        .filter((entry) => entry.errors.length > 0)
        .slice(0, 3)
        .map((entry) => `${entry.handle}: ${entry.errors.join("; ")}`);
      job.flash = {
        saved: String(imported),
        mapped: String(job.rowCount ?? 0),
        ...(handleWarnings.length > 0
          ? {
              error: `Imported ${imported} product(s), but some metafields failed: ${handleWarnings.join(" | ")}`,
            }
          : {}),
      };
      if (handleWarnings.length > 0) {
        job.error = job.flash.error;
      }
      job.status = "done";
      await saveImportSession(job.shopId, {
        id: job.id,
        shopId: job.shopId,
        fileName: job.fileName,
        status: "completed",
        createdAt: new Date(job.createdAt).toISOString(),
        updatedAt: new Date().toISOString(),
        mappingNotes: job.mappingNotes,
        rowCount: job.rowCount,
        previewSummary: job.previewSummary,
        drafts: job.drafts,
        csv: job.csv,
        report,
      });
    }
  } catch (error) {
    job.status = "error";
    job.error = error instanceof Error ? error.message : "Import failed";
  }

  return toPublicJob(job);
}

function toPublicJob(job: ExcelMapJobRecord): ExcelMapJobPublic {
  markStalePreviewJob(job);
  return {
    id: job.id,
    status: job.status,
    error: job.error,
    mappingNotes: job.mappingNotes,
    rowCount: job.rowCount,
    previewRows: job.previewRows,
    previewSummary: job.previewSummary,
    mappedColumnCount: job.mappedColumnCount,
    canResume: Boolean(job.resumeFromHandle),
    resumeFromHandle: job.resumeFromHandle,
    flash: job.flash,
    downloadReady: Boolean(job.csv) && job.status !== "error",
    importDone: job.status === "done",
  };
}

function storedStatusToJobStatus(
  stored: StoredImportSessionStatus,
  resumeFromHandle?: string,
  updatedAt?: string,
): ExcelMapJobStatus {
  if (stored === "processing") {
    if (
      updatedAt &&
      Date.now() - Date.parse(updatedAt) > PREVIEW_STALE_MS
    ) {
      return "error";
    }
    return "processing";
  }
  if (stored === "completed") {
    return "done";
  }
  if (stored === "importing") {
    return "importing";
  }
  if (stored === "failed") {
    return resumeFromHandle ? "preview_ready" : "error";
  }
  return "preview_ready";
}
function storedSessionToPublic(
  stored: Awaited<ReturnType<typeof getImportSession>>,
): ExcelMapJobPublic | null {
  if (!stored) {
    return null;
  }

  const status = storedStatusToJobStatus(
    stored.status,
    stored.resumeFromHandle,
    stored.updatedAt,
  );

  return {
    id: stored.id,
    status,
    error:
      stored.error ??
      (status === "error" && stored.status === "processing"
        ? "Preview timed out — upload Excel again"
        : undefined),
    mappingNotes: stored.mappingNotes,
    rowCount: stored.rowCount,
    previewRows: stored.previewRows,
    previewSummary: stored.previewSummary,
    mappedColumnCount: stored.previewRows?.length,
    canResume: Boolean(stored.resumeFromHandle),
    resumeFromHandle: stored.resumeFromHandle,
    downloadReady: Boolean(stored.csv) && status !== "error",
    importDone: status === "done",
  };
}

export async function waitForExcelMapJob(
  jobId: string,
  shopId: string,
  timeoutMs = 180_000,
): Promise<ExcelMapJobPublic | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await getExcelMapJob(jobId, shopId);
    if (!job) {
      return null;
    }
    if (
      job.status === "preview_ready" ||
      job.status === "error" ||
      job.status === "done"
    ) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return getExcelMapJob(jobId, shopId);
}

export async function getExcelMapJob(
  jobId: string,
  shopId: string,
): Promise<ExcelMapJobPublic | null> {
  const job = jobs.get(jobId);
  if (job && job.shopId === shopId) {
    return toPublicJob(job);
  }

  const stored = await getImportSession(shopId, jobId);
  if (stored) {
    if (stored.status === "processing" && !jobs.get(jobId)) {
      return {
        id: stored.id,
        status: "error",
        error: "Previous preview interrupted. Upload spreadsheet to start again.",
        downloadReady: false,
        importDone: false,
      };
    }
    return storedSessionToPublic(stored);
  }
  return null;
}

export async function getExcelMapJobDownload(
  jobId: string,
  shopId: string,
): Promise<{ csv: string; fileName: string } | null> {
  const job = jobs.get(jobId);
  if (job && job.shopId === shopId && job.csv) {
    const stem =
      job.fileName.replace(/\.(xlsx|xls)$/i, "").trim() || "mapped-import";
    const ascii = stem.replace(/[^\x20-\x7E]+/g, "-").replace(/^-+|-+$/g, "");
    return {
      csv: job.csv,
      fileName: `${ascii || "mapped-import"}-mapped.csv`,
    };
  }

  const stored = await getImportSession(shopId, jobId);
  if (!stored?.csv) {
    return null;
  }
  const stem =
    stored.fileName.replace(/\.(xlsx|xls)$/i, "").trim() || "mapped-import";
  const ascii = stem.replace(/[^\x20-\x7E]+/g, "-").replace(/^-+|-+$/g, "");
  return {
    csv: stored.csv,
    fileName: `${ascii || "mapped-import"}-mapped.csv`,
  };
}
