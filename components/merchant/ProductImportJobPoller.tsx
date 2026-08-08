"use client";

import { useEffect, useState } from "react";

interface ExcelMapJobResponse {
  status: "queued" | "processing" | "done" | "error";
  autoImport: boolean;
  error?: string;
  flash?: Record<string, string>;
  downloadReady?: boolean;
}

interface ProductImportJobPollerProps {
  shopId: string;
  jobId: string;
}

function redirectWithFlash(flash: Record<string, string>): void {
  const params = new URLSearchParams({ tab: "ai" });
  for (const [key, value] of Object.entries(flash)) {
    params.set(key, value);
  }
  window.location.assign(`/merchant/import?${params.toString()}`);
}

export function ProductImportJobPoller({
  shopId,
  jobId,
}: ProductImportJobPollerProps) {
  const [message, setMessage] = useState(
    "Processing Excel with AI — usually 1–2 minutes. Keep this tab open.",
  );

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll(): Promise<void> {
      try {
        const response = await fetch(
          `/api/shops/${shopId}/import/excel-map/jobs/${jobId}`,
          { credentials: "same-origin" },
        );
        if (!response.ok) {
          if (!cancelled) {
            setMessage("Could not check import status — refresh and try again.");
          }
          return;
        }

        const job = (await response.json()) as ExcelMapJobResponse;
        if (cancelled) {
          return;
        }

        if (job.status === "queued" || job.status === "processing") {
          timer = setTimeout(() => {
            void poll();
          }, 2500);
          return;
        }

        if (job.status === "error") {
          redirectWithFlash({
            error: job.error ?? "Excel import failed",
          });
          return;
        }

        if (job.autoImport) {
          redirectWithFlash(job.flash ?? { saved: "0" });
          return;
        }

        if (job.downloadReady) {
          window.location.assign(
            `/api/shops/${shopId}/import/excel-map/jobs/${jobId}/download`,
          );
          window.history.replaceState({}, "", "/merchant/import?tab=ai");
          setMessage("CSV download started.");
          return;
        }

        setMessage("Import finished but download is not ready — try again.");
      } catch {
        if (!cancelled) {
          setMessage("Network error while processing — refresh and try again.");
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
  }, [shopId, jobId]);

  return (
    <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
      {message}
    </p>
  );
}
