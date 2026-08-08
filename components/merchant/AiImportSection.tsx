"use client";

import { useEffect, useState } from "react";
import type { ExcelMapJobPublic } from "@/lib/import/excel-map-jobs";
import {
  regenerateImportSystemPromptAction,
  saveImportSystemPromptAction,
} from "@/app/merchant/import/actions";

interface AiImportSectionProps {
  shopId: string;
  systemPrompt: string;
  promptPackVersion?: string | null;
  jobId?: string | null;
  initialJob?: ExcelMapJobPublic | null;
}

function isJobRunning(status: ExcelMapJobPublic["status"] | undefined): boolean {
  return status === "queued" || status === "processing" || status === "importing";
}

function initialStatusMessage(
  jobId: string | null | undefined,
  initialJob: ExcelMapJobPublic | null | undefined,
): string | null {
  if (!jobId) {
    return null;
  }
  if (initialJob?.status === "preview_ready") {
    return null;
  }
  if (initialJob?.status === "error") {
    return initialJob.error ?? "Preview failed";
  }
  if (isJobRunning(initialJob?.status)) {
    return "Running Excel transform — keep this tab open.";
  }
  return "Running Excel transform — usually under a minute.";
}

function redirectWithFlash(flash: Record<string, string>): void {
  const params = new URLSearchParams({ tab: "ai" });
  for (const [key, value] of Object.entries(flash)) {
    params.set(key, value);
  }
  window.location.assign(`/merchant/import?${params.toString()}`);
}

export function AiImportSection({
  shopId,
  systemPrompt,
  promptPackVersion,
  jobId,
  initialJob,
}: AiImportSectionProps) {
  const [prompt, setPrompt] = useState(systemPrompt);
  const [job, setJob] = useState<ExcelMapJobPublic | null>(initialJob ?? null);
  const [polling, setPolling] = useState(
    Boolean(jobId) && isJobRunning(initialJob?.status),
  );
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(() =>
    initialStatusMessage(jobId, initialJob),
  );

  const [pollStartedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!jobId || initialJob?.status === "preview_ready") {
      return;
    }

    if (!isJobRunning(initialJob?.status) && initialJob?.status === "error") {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll(): Promise<void> {
      if (Date.now() - pollStartedAt > 8 * 60 * 1000) {
        if (!cancelled) {
          setMessage(
            "Preview is taking too long — refresh the page or upload again.",
          );
          setPolling(false);
        }
        return;
      }

      try {
        const response = await fetch(
          `/api/shops/${shopId}/import/excel-map/jobs/${jobId}`,
          { credentials: "same-origin" },
        );
        if (response.status === 404) {
          if (!cancelled) {
            setMessage(
              "Preview session lost (server restarted) — upload Excel again.",
            );
            setPolling(false);
          }
          return;
        }
        if (!response.ok) {
          if (!cancelled) {
            setMessage("Could not check preview status — sign in and try again.");
            setPolling(false);
          }
          return;
        }

        const payload = (await response.json()) as ExcelMapJobPublic;
        if (cancelled) {
          return;
        }

        setJob(payload);

        if (
          payload.status === "queued" ||
          payload.status === "processing" ||
          payload.status === "importing"
        ) {
          const elapsedSec = Math.floor((Date.now() - pollStartedAt) / 1000);
          setMessage(
            `Running Excel transform… ${elapsedSec}s (large files can take a few minutes)`,
          );
          timer = setTimeout(() => {
            void poll();
          }, 2000);
          return;
        }

        setPolling(false);
        setMessage(null);

        if (payload.status === "error") {
          setMessage(payload.error ?? "Preview failed");
          return;
        }

        if (payload.importDone && payload.flash) {
          redirectWithFlash(payload.flash);
        }
      } catch {
        if (!cancelled) {
          setMessage("Network error — refresh and try again.");
          setPolling(false);
        }
      }
    }

    void poll();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [shopId, jobId, pollStartedAt, initialJob?.status]);

  async function handleConfirmImport(resume = false): Promise<void> {
    if (!jobId || job?.status !== "preview_ready") {
      return;
    }
    setImporting(true);
    setMessage(resume ? "Resuming import…" : "Importing products to Shopify…");
    try {
      const response = await fetch(
        `/api/shops/${shopId}/import/excel-map/jobs/${jobId}/confirm`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            resume && job?.resumeFromHandle
              ? { resumeFromHandle: job.resumeFromHandle }
              : {},
          ),
        },
      );
      const payload = (await response.json()) as ExcelMapJobPublic & {
        error?: string;
      };
      if (!response.ok) {
        setMessage(payload.error ?? "Import failed");
        setImporting(false);
        return;
      }
      if (payload.flash) {
        redirectWithFlash(payload.flash);
        return;
      }
      setMessage("Import finished.");
    } catch {
      setMessage("Import failed — try again.");
    } finally {
      setImporting(false);
    }
  }

  const previewReady = job?.status === "preview_ready";
  const errorCount =
    job?.previewSummary?.error ??
    job?.previewRows?.filter((row) => row.action === "error").length ??
    0;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">System prompt</h3>
          {promptPackVersion ? (
            <span className="text-xs text-muted-foreground">
              pack <code>{promptPackVersion}</code>
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Generated from this store&apos;s metafield definitions. AI uses this to
          map your Excel columns to Shopify fields.
        </p>
        <form action={saveImportSystemPromptAction} className="flex flex-col gap-2">
          <input type="hidden" name="returnTo" value="/merchant/import?tab=ai" />
          <textarea
            name="systemPrompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={12}
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed"
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="mf-btn text-xs">
              Save prompt
            </button>
          </div>
        </form>
        <form action={regenerateImportSystemPromptAction}>
          <input type="hidden" name="returnTo" value="/merchant/import?tab=ai" />
          <button type="submit" className="mf-btn text-xs">
            Regenerate from store schema
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-medium">Upload Excel</h3>
        <p className="text-sm text-muted-foreground">
          Upload messy spreadsheet. App maps columns using the system prompt,
          cleans values, then shows preview. Import only after you confirm.
        </p>
        <form
          method="POST"
          action={`/api/shops/${shopId}/import/excel-map`}
          encType="multipart/form-data"
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="returnTo" value="/merchant/import?tab=ai" />
          <input type="hidden" name="systemPrompt" value={prompt} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Excel file (.xlsx)</span>
            <input
              name="file"
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <button type="submit" className="mf-btn-primary w-fit" disabled={polling}>
            Generate preview
          </button>
        </form>
        {!promptPackVersion ? (
          <p className="text-xs text-muted-foreground">
            Tip: click <strong>Refresh import columns</strong> above first.
          </p>
        ) : null}
      </section>

      {message ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          {message}
        </p>
      ) : null}

      {previewReady && job ? (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-medium">Preview</h3>
          <p className="text-xs text-muted-foreground">
            {job.rowCount ?? 0} row(s) · {job.mappedColumnCount ?? 0} column(s)
            mapped
            {job.previewSummary
              ? ` · ${job.previewSummary.create} create, ${job.previewSummary.update} update, ${job.previewSummary.skip} skip, ${job.previewSummary.error} error`
              : ""}
          </p>
          {job.mappingNotes ? (
            <p className="text-xs text-muted-foreground">{job.mappingNotes}</p>
          ) : null}

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Action</th>
                  <th className="px-2 py-1.5 font-medium">#</th>
                  <th className="px-2 py-1.5 font-medium">Title</th>
                  <th className="px-2 py-1.5 font-medium">Handle</th>
                  <th className="px-2 py-1.5 font-medium">Price</th>
                  <th className="px-2 py-1.5 font-medium">Template</th>
                  <th className="px-2 py-1.5 font-medium">Metafields</th>
                  <th className="px-2 py-1.5 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {(job.previewRows ?? []).map((row) => (
                  <tr key={row.index} className="border-b border-border last:border-0">
                    <td className="px-2 py-1.5 capitalize">{row.action ?? "—"}</td>
                    <td className="px-2 py-1.5">{row.index}</td>
                    <td className="max-w-[12rem] truncate px-2 py-1.5">
                      {row.title || "—"}
                    </td>
                    <td className="max-w-[10rem] truncate px-2 py-1.5 text-muted-foreground">
                      {row.handle || "—"}
                    </td>
                    <td className="px-2 py-1.5">{row.price || "—"}</td>
                    <td className="px-2 py-1.5">{row.template_suffix || "—"}</td>
                    <td className="px-2 py-1.5">{row.metafieldCount}</td>
                    <td className="px-2 py-1.5 text-amber-700 dark:text-amber-400">
                      {row.warnings.join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(job.rowCount ?? 0) > 15 ? (
            <p className="text-xs text-muted-foreground">
              Showing first 15 of {job.rowCount} rows.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => void handleConfirmImport()}
              disabled={importing || errorCount > 0}
              className="mf-btn-primary"
            >
              {importing
                ? "Importing…"
                : `Import ${job.rowCount ?? 0} product${job.rowCount === 1 ? "" : "s"}`}
            </button>
            {job.canResume && job.resumeFromHandle ? (
              <button
                type="button"
                onClick={() => void handleConfirmImport(true)}
                disabled={importing}
                className="mf-btn"
              >
                Resume from {job.resumeFromHandle}
              </button>
            ) : null}
            {jobId && job.downloadReady ? (
              <a
                href={`/api/shops/${shopId}/import/excel-map/jobs/${jobId}/download`}
                className="mf-btn"
              >
                Download mapped CSV
              </a>
            ) : null}
          </div>
          {errorCount > 0 ? (
            <p className="text-xs text-destructive">
              Fix rows with warnings before import.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
