"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Upload,
} from "lucide-react";
import type {
  ExcelMapJobPublic,
  ImportRowOverride,
} from "@/lib/import/excel-map-jobs";
import { isUnsupportedMetafieldType } from "@/lib/metafields/validators";
import type { MetafieldDefinitionNode } from "@/types/shopify";

interface AiImportSectionProps {
  shopId: string;
  definitions?: MetafieldDefinitionNode[];
  selectedMetafields?: string[] | null;
  systemPrompt: string;
  promptPackVersion?: string | null;
  jobId?: string | null;
  initialJob?: ExcelMapJobPublic | null;
}

function isJobRunning(status: ExcelMapJobPublic["status"] | undefined): boolean {
  return status === "queued" || status === "processing" || status === "importing";
}

export function AiImportSection({
  shopId,
  definitions = [],
  selectedMetafields: initialSelectedMetafields,
  systemPrompt: initialSystemPrompt,
  promptPackVersion: initialPackVersion,
  jobId: initialJobId,
  initialJob,
}: AiImportSectionProps) {
  const supportedDefinitions = definitions.filter(
    (def) => !isUnsupportedMetafieldType(def.type.name),
  );
  const allMetafieldKeys = supportedDefinitions.map(
    (def) => `${def.namespace}.${def.key}`,
  );
  const [selectedKeys, setSelectedKeys] = useState<string[]>(() =>
    initialSelectedMetafields && initialSelectedMetafields.length > 0
      ? initialSelectedMetafields
      : allMetafieldKeys,
  );
  const [prompt, setPrompt] = useState(initialSystemPrompt);
  const [packVersion, setPackVersion] = useState(initialPackVersion);

  // Button state indicators
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [regenStatus, setRegenStatus] = useState<"idle" | "regenerating" | "regenerated">("idle");

  const [activeJobId, setActiveJobId] = useState<string | null>(initialJobId ?? null);
  const [job, setJob] = useState<ExcelMapJobPublic | null>(initialJob ?? null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isGenerating, setIsGenerating] = useState<boolean>(() => isJobRunning(initialJob?.status));
  const [progressPercent, setProgressPercent] = useState<number>(() => {
    if (initialJob?.status === "preview_ready") return 100;
    if (isJobRunning(initialJob?.status)) return 40;
    return 0;
  });
  const [progressStage, setProgressStage] = useState<string>(() => {
    if (initialJob?.status === "preview_ready") return "Preview ready";
    if (isJobRunning(initialJob?.status)) return "AI analyzing spreadsheet & mapping fields…";
    return "";
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [rowOverrides, setRowOverrides] = useState<
    Record<number, { handle: string; action?: "create" | "update" | "skip" }>
  >({});
  const [editingHandleIndex, setEditingHandleIndex] = useState<number | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Poll Job Status
  const pollJob = (currentJobId: string, startTime: number) => {
    setIsGenerating(true);
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
    }

    const checkStatus = async () => {
      if (Date.now() - startTime > 95 * 1000) {
        setIsGenerating(false);
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        setErrorMessage("Preview generation timed out. Please click Clear and try again.");
        return;
      }

      try {
        const response = await fetch(
          `/api/shops/${shopId}/import/excel-map/jobs/${currentJobId}`,
          { credentials: "include" },
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to fetch job status");
        }

        const data = (await response.json()) as ExcelMapJobPublic;
        setJob(data);

        if (data.status === "queued") {
          setProgressPercent(25);
          setProgressStage("Queued for AI analysis…");
          pollTimerRef.current = setTimeout(checkStatus, 2000);
        } else if (data.status === "processing") {
          setProgressPercent((prev) => Math.min(prev + 6, 88));
          setProgressStage("AI mapping columns & transforming rows…");
          pollTimerRef.current = setTimeout(checkStatus, 2000);
        } else if (data.status === "preview_ready") {
          setProgressPercent(100);
          setProgressStage("Preview ready!");
          setIsGenerating(false);
          if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
          setTimeout(() => {
            document.getElementById("ai-preview-section")?.scrollIntoView({ behavior: "smooth" });
          }, 150);
        } else if (data.status === "error") {
          setIsGenerating(false);
          if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
          setProgressPercent(0);
          setProgressStage("");
          setErrorMessage(data.error || "Preview generation failed");
        } else {
          pollTimerRef.current = setTimeout(checkStatus, 2000);
        }
      } catch (err) {
        setIsGenerating(false);
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        setErrorMessage(err instanceof Error ? err.message : "Network error checking status");
      }
    };

    void checkStatus();
  };

  // Clean job query param from URL without reloading
  useEffect(() => {
    if (!initialJobId) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("job")) {
      url.searchParams.delete("job");
      window.history.replaceState(null, "", url.toString());
    }
  }, [initialJobId]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  // Resume polling on mount if initial job is running
  useEffect(() => {
    if (!initialJobId || !isJobRunning(initialJob?.status)) return;
    const timer = setTimeout(() => {
      pollJob(initialJobId, Date.now());
    }, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJobId]);

  // Reset or clear current upload
  const handleReset = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    setIsGenerating(false);
    setSelectedFile(null);
    setJob(null);
    setActiveJobId(null);
    setErrorMessage(null);
    setProgressPercent(0);
    setProgressStage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("job");
      window.history.replaceState(null, "", url.toString());
    }
  };

  // Handle Save Prompt
  const handleSavePrompt = async () => {
    if (saveStatus === "saving") return;
    setSaveStatus("saving");
    setErrorMessage(null);
    setToastMessage("Saving prompt…");

    try {
      const response = await fetch(`/api/shops/${shopId}/import/prompt`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          systemPrompt: prompt,
          ...(supportedDefinitions.length > 0
            ? { selectedMetafields: selectedKeys }
            : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.error) {
        throw new Error(data.error || `Failed to save prompt (HTTP ${response.status})`);
      }
      setSaveStatus("saved");
      setToastMessage("Prompt saved successfully.");
      setTimeout(() => {
        setSaveStatus("idle");
        setToastMessage(null);
      }, 3000);
    } catch (err) {
      setSaveStatus("idle");
      setToastMessage(null);
      const msg = err instanceof Error ? err.message : "Failed to save prompt";
      setErrorMessage(msg);
    }
  };

  // Handle Regenerate Prompt
  const handleRegeneratePrompt = async () => {
    if (regenStatus === "regenerating") return;
    setRegenStatus("regenerating");
    setErrorMessage(null);
    setToastMessage("Regenerating prompt from Shopify store schema…");

    try {
      const response = await fetch(`/api/shops/${shopId}/import/prompt`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "regenerate",
          ...(supportedDefinitions.length > 0
            ? { selectedMetafields: selectedKeys }
            : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.error) {
        throw new Error(data.error || `Failed to regenerate prompt (HTTP ${response.status})`);
      }
      if (data.systemPrompt) {
        setPrompt(data.systemPrompt);
      }
      if (data.packVersion) {
        setPackVersion(data.packVersion);
      }
      setRegenStatus("regenerated");
      setToastMessage("Regenerated system prompt from current Shopify store schema.");
      setTimeout(() => {
        setRegenStatus("idle");
        setToastMessage(null);
      }, 3000);
    } catch (err) {
      setRegenStatus("idle");
      setToastMessage(null);
      const msg = err instanceof Error ? err.message : "Failed to regenerate prompt";
      setErrorMessage(msg);
    }
  };

  // Form submit handler with progressive enhancement
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    const fileToUpload = selectedFile || fileInputRef.current?.files?.[0] || null;
    if (!fileToUpload) {
      e.preventDefault();
      setErrorMessage("Please choose a spreadsheet file (.xlsx or .csv) first.");
      fileInputRef.current?.click();
      return;
    }
    // Intercept client-side for live upload progress bar and polling
    e.preventDefault();
    await handleGeneratePreview(fileToUpload);
  };

  // Handle Upload & Generate Preview
  const handleGeneratePreview = async (explicitFile?: File | null) => {
    if (isGenerating) return;

    const fileToUpload = explicitFile || selectedFile || fileInputRef.current?.files?.[0] || null;
    if (!fileToUpload) {
      setErrorMessage("Please choose a spreadsheet file (.xlsx or .csv) first.");
      fileInputRef.current?.click();
      return;
    }

    setIsGenerating(true);
    setImportSuccess(false);
    setErrorMessage(null);
    setRowOverrides({});
    setEditingHandleIndex(null);
    setProgressPercent(15);
    setProgressStage("Uploading Excel spreadsheet…");
    setElapsedSeconds(0);
    setJob(null);

    const startTime = Date.now();
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const formData = new FormData();
    formData.append("file", fileToUpload);
    formData.append("systemPrompt", prompt);
    if (supportedDefinitions.length > 0) {
      formData.append("selectedMetafields", JSON.stringify(selectedKeys));
    }

    try {
      const response = await fetch(`/api/shops/${shopId}/import/excel-map`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "x-json-response": "1",
        },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.error) {
        throw new Error(data.error || `Upload failed (HTTP ${response.status})`);
      }

      const returnedJobId = data.jobId;
      setActiveJobId(returnedJobId);

      if (data.job?.status === "preview_ready") {
        setJob(data.job);
        setProgressPercent(100);
        setProgressStage("Preview ready!");
        setIsGenerating(false);
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        setTimeout(() => {
          document.getElementById("ai-preview-section")?.scrollIntoView({ behavior: "smooth" });
        }, 150);
      } else if (data.job?.status === "error") {
        setJob(data.job);
        setIsGenerating(false);
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        setProgressPercent(0);
        setProgressStage("");
        setErrorMessage(data.job.error || "Preview generation failed");
      } else {
        setProgressPercent(35);
        setProgressStage("AI analyzing columns & mapping fields…");
        pollJob(returnedJobId, startTime);
      }
    } catch (err) {
      setIsGenerating(false);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      setProgressPercent(0);
      setProgressStage("");
      const msg = err instanceof Error ? err.message : "Failed to generate preview";
      setErrorMessage(msg);
    }
  };

  // Handle Confirm Import to Shopify
  const handleConfirmImport = async (resume = false) => {
    if (!activeJobId || importing) return;
    setImporting(true);
    setImportSuccess(false);
    setErrorMessage(null);

    try {
      const overridesList: ImportRowOverride[] = Object.entries(rowOverrides).map(
        ([idx, entry]) => ({
          index: Number(idx),
          handle: entry.handle,
          ...(entry.action ? { action: entry.action } : {}),
        }),
      );
      const response = await fetch(
        `/api/shops/${shopId}/import/excel-map/jobs/${activeJobId}/confirm`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(resume && job?.resumeFromHandle
              ? { resumeFromHandle: job.resumeFromHandle }
              : {}),
            ...(overridesList.length > 0 ? { rowOverrides: overridesList } : {}),
          }),
        },
      );

      let payload = (await response.json().catch(() => ({}))) as ExcelMapJobPublic & {
        error?: string;
      };
      if (payload && typeof payload === "object" && "id" in payload) {
        setJob(payload);
      }
      if (!response.ok) {
        throw new Error(payload?.error || "Import failed");
      }

      const deadline = Date.now() + 180_000;
      while (payload.status === "importing" && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        const pollResponse = await fetch(
          `/api/shops/${shopId}/import/excel-map/jobs/${activeJobId}`,
          { credentials: "include" },
        );
        if (!pollResponse.ok) {
          throw new Error(`Failed to check import status (HTTP ${pollResponse.status})`);
        }
        payload = (await pollResponse.json()) as ExcelMapJobPublic & { error?: string };
        setJob(payload);
      }

      if (payload.status === "importing") {
        throw new Error("Import timed out waiting for completion");
      }

      if (payload?.error || payload?.flash?.error) {
        throw new Error(payload.error || payload.flash?.error || "Import failed");
      }

      setImportSuccess(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const previewReady = job?.status === "preview_ready";
  const flaggedRows = (job?.previewRows ?? []).filter((row) =>
    Boolean(row.conflictReason && !rowOverrides[row.index]),
  );
  const resolvedErrorRows = new Set(
    (job?.previewRows ?? [])
      .filter((row) => row.action === "error" && Boolean(rowOverrides[row.index]?.handle))
      .map((row) => row.index),
  );
  const rawErrorCount =
    job?.previewSummary?.error ??
    job?.previewRows?.filter((row) => row.action === "error").length ??
    0;
  const errorCount = Math.max(0, rawErrorCount - resolvedErrorRows.size);

  const handleApproveAllSuggested = () => {
    const next: Record<number, { handle: string; action?: "create" | "update" | "skip" }> = {
      ...rowOverrides,
    };
    for (const row of job?.previewRows ?? []) {
      if (row.suggestedHandle && !next[row.index]) {
        next[row.index] = { handle: row.suggestedHandle, action: "create" };
      }
    }
    setRowOverrides(next);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Toast Notification Banner */}
      {toastMessage ? (
        <div className="rounded-lg bg-primary/10 border border-primary/20 px-3.5 py-2 text-xs font-medium text-primary flex items-center gap-2 shadow-sm animate-in fade-in">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      ) : null}

      {/* System Prompt Section */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">System prompt</h3>
          </div>
          {packVersion ? (
            <span className="text-xs text-muted-foreground">
              pack <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{packVersion}</code>
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Choose which store metafields AI should fill, then click{" "}
          <strong>Regenerate from store schema</strong> to tailor the system prompt.
        </p>
        {supportedDefinitions.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium">
                Target metafields ({selectedKeys.length} of {supportedDefinitions.length})
              </span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedKeys(allMetafieldKeys)}
                  className="text-primary hover:underline cursor-pointer"
                >
                  All
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedKeys(
                      allMetafieldKeys.filter((k) => k.startsWith("custom.")),
                    )
                  }
                  className="text-primary hover:underline cursor-pointer"
                >
                  Custom only
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={() => setSelectedKeys([])}
                  className="text-muted-foreground hover:underline cursor-pointer"
                >
                  None
                </button>
              </div>
            </div>
            <div className="grid max-h-44 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
              {supportedDefinitions.map((def) => {
                const fullKey = `${def.namespace}.${def.key}`;
                const checked = selectedKeys.includes(fullKey);
                return (
                  <label
                    key={def.id}
                    className="flex items-start gap-2 rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs cursor-pointer hover:bg-muted/30"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedKeys((prev) =>
                          e.target.checked
                            ? [...prev, fullKey]
                            : prev.filter((k) => k !== fullKey),
                        );
                      }}
                      className="mt-0.5 accent-primary cursor-pointer"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {def.name}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        {fullKey} ({def.type.name})
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-3">
          <textarea
            name="systemPrompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={9}
            className="w-full rounded-lg border border-input bg-background p-3 font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-ring/50"
          />
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Save Prompt Button */}
            <button
              type="button"
              onClick={handleSavePrompt}
              disabled={saveStatus === "saving" || regenStatus === "regenerating"}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all shadow-sm cursor-pointer select-none ${
                saveStatus === "saved"
                  ? "bg-emerald-600 text-white"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              }`}
            >
              {saveStatus === "saving" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : saveStatus === "saved" ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Saved ✓
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save prompt
                </>
              )}
            </button>

            {/* Regenerate Prompt Button */}
            <button
              type="button"
              onClick={handleRegeneratePrompt}
              disabled={saveStatus === "saving" || regenStatus === "regenerating"}
              className={`inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3.5 py-1.5 text-xs font-medium transition-all shadow-sm hover:bg-muted cursor-pointer select-none disabled:opacity-50 ${
                regenStatus === "regenerated" ? "border-emerald-500 text-emerald-600" : "text-foreground"
              }`}
            >
              {regenStatus === "regenerating" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Regenerating…
                </>
              ) : regenStatus === "regenerated" ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  Regenerated ✓
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate from store schema
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Upload Excel Section */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Upload Excel</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Upload your spreadsheet. App maps columns using the system prompt,
          cleans values, and shows preview.
        </p>
        <form
          method="POST"
          action={`/api/shops/${shopId}/import/excel-map`}
          encType="multipart/form-data"
          onSubmit={handleFormSubmit}
          className="flex flex-col gap-3.5"
        >
          <input type="hidden" name="returnTo" value="/merchant/import?tab=ai" />
          <input type="hidden" name="systemPrompt" value={prompt} />
          {supportedDefinitions.length > 0 ? (
            <input
              type="hidden"
              name="selectedMetafields"
              value={JSON.stringify(selectedKeys)}
            />
          ) : null}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Spreadsheet file (.xlsx, .xls, .csv)</span>
            <input
              ref={fileInputRef}
              name="file"
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              disabled={isGenerating}
              required
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setSelectedFile(f);
                if (f) setErrorMessage(null);
              }}
              className={`w-full rounded-lg border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium hover:file:bg-muted/80 cursor-pointer ${
                errorMessage && !selectedFile
                  ? "border-destructive ring-1 ring-destructive/40"
                  : "border-input"
              }`}
            />
          </label>

          {selectedFile ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              <span>Ready: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
            </p>
          ) : null}

          {errorMessage ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          ) : null}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="submit"
              disabled={isGenerating}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 cursor-pointer select-none w-fit"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating preview…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Generate preview
                </>
              )}
            </button>

            {isGenerating || selectedFile || job || errorMessage ? (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-input bg-background px-3.5 py-2.5 text-xs font-medium shadow-sm hover:bg-muted cursor-pointer select-none"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {isGenerating ? "Cancel" : "Clear"}
              </button>
            ) : null}
          </div>
        </form>
      </section>

      {/* Progress Bar Section (Visible when generating) */}
      {isGenerating ? (
        <section className="flex flex-col gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm transition-all animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-medium text-primary">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>{progressStage}</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs font-semibold text-primary">
              <span>{elapsedSeconds}s</span>
              <span>·</span>
              <span>{progressPercent}%</span>
            </div>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-primary/20">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Processing columns with AI model and preparing Shopify draft records. Keep this tab open.
          </p>
        </section>
      ) : null}


      {/* Import Success Banner */}
      {importSuccess ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-sm text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-2 shadow-sm">
          <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <span>Import completed successfully! Products and metafields are now live in your Shopify store.</span>
        </div>
      ) : null}

      {/* Preview Table */}
      {previewReady && job ? (
        <section id="ai-preview-section" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Preview</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-medium">
              <Check className="h-3 w-3" /> Ready to import
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            {job.rowCount ?? 0} row(s) · {job.mappedColumnCount ?? 0} column(s) mapped
            {job.previewSummary
              ? ` · ${job.previewSummary.create} create, ${job.previewSummary.update} update, ${job.previewSummary.skip} skip, ${job.previewSummary.error} error`
              : ""}
          </p>
          {job.mappingNotes ? (
            <p className="text-xs text-muted-foreground italic font-mono">
              {job.mappingNotes}
            </p>
          ) : null}

          {flaggedRows.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <span>
                ⚠️ {flaggedRows.length} row(s) flagged with handle conflicts. Approve
                suggested handles or edit handles below before importing.
              </span>
              <button
                type="button"
                onClick={handleApproveAllSuggested}
                className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 cursor-pointer"
              >
                Approve all suggested
              </button>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-3 py-2 font-semibold">Action</th>
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Title</th>
                  <th className="px-3 py-2 font-semibold">Handle</th>
                  <th className="px-3 py-2 font-semibold">Price</th>
                  <th className="px-3 py-2 font-semibold">Template</th>
                  <th className="px-3 py-2 font-semibold">Metafields</th>
                  <th className="px-3 py-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {(job.previewRows ?? []).map((row) => {
                  const override = rowOverrides[row.index];
                  const effectiveAction = override?.action ?? row.action ?? "—";
                  const effectiveHandle = override?.handle ?? row.handle;
                  const isFlagged = Boolean(row.conflictReason && !override);
                  const isEditing =
                    editingHandleIndex === row.index || Boolean(row.conflictReason);

                  return (
                    <tr
                      key={row.index}
                      className={`border-b border-border last:border-0 hover:bg-muted/20 ${
                        isFlagged ? "bg-amber-500/5" : ""
                      }`}
                    >
                      <td className="px-3 py-2 capitalize font-medium">
                        {row.conflictReason || override ? (
                          <select
                            value={effectiveAction}
                            onChange={(e) => {
                              const action = e.target.value as
                                | "create"
                                | "update"
                                | "skip";
                              setRowOverrides((prev) => ({
                                ...prev,
                                [row.index]: {
                                  handle:
                                    action === "create" &&
                                    effectiveHandle === row.handle &&
                                    row.suggestedHandle
                                      ? row.suggestedHandle
                                      : effectiveHandle,
                                  action,
                                },
                              }));
                            }}
                            className="rounded border border-input bg-background px-1.5 py-0.5 text-xs capitalize"
                          >
                            <option value="create">create</option>
                            {row.action === "update" ? (
                              <option value="update">update</option>
                            ) : null}
                            <option value="skip">skip</option>
                          </select>
                        ) : (
                          effectiveAction
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">
                        {row.index}
                      </td>
                      <td className="max-w-[12rem] truncate px-3 py-2 font-medium">
                        {row.title || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        <div className="flex flex-col gap-1">
                          {isEditing ? (
                            <input
                              type="text"
                              value={effectiveHandle}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRowOverrides((prev) => ({
                                  ...prev,
                                  [row.index]: {
                                    handle: val,
                                    action:
                                      val !== row.handle
                                        ? "create"
                                        : prev[row.index]?.action,
                                  },
                                }));
                              }}
                              className="w-44 rounded border border-input bg-background px-2 py-0.5 text-xs font-mono"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingHandleIndex(row.index)}
                              title="Click to edit handle"
                              className="max-w-[10rem] truncate text-left text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              {effectiveHandle || "—"}
                            </button>
                          )}
                          {row.suggestedHandle &&
                          effectiveHandle !== row.suggestedHandle ? (
                            <button
                              type="button"
                              onClick={() =>
                                setRowOverrides((prev) => ({
                                  ...prev,
                                  [row.index]: {
                                    handle: row.suggestedHandle!,
                                    action: "create",
                                  },
                                }))
                              }
                              className="w-fit rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 cursor-pointer"
                            >
                              Approve: {row.suggestedHandle}
                            </button>
                          ) : override ? (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                              ✓ Approved ({effectiveAction})
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2">{row.price || "—"}</td>
                      <td className="px-3 py-2">{row.template_suffix || "—"}</td>
                      <td className="px-3 py-2 font-mono">{row.metafieldCount}</td>
                      <td className="px-3 py-2 text-amber-700 dark:text-amber-400">
                        {override
                          ? `Using "${effectiveHandle}"`
                          : row.conflictReason || row.warnings.join(", ") || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(job.rowCount ?? 0) > 15 ? (
            <p className="text-xs text-muted-foreground">
              Showing first 15 of {job.rowCount} rows.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2.5 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => handleConfirmImport(false)}
              disabled={importing || errorCount > 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
            >
              {importing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Importing to Shopify…
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  {`Import ${job.rowCount ?? 0} product${job.rowCount === 1 ? "" : "s"}`}
                </>
              )}
            </button>
            {job.canResume && job.resumeFromHandle ? (
              <button
                type="button"
                onClick={() => handleConfirmImport(true)}
                disabled={importing}
                className="mf-btn text-xs cursor-pointer"
              >
                Resume from {job.resumeFromHandle}
              </button>
            ) : null}
            {activeJobId && job.downloadReady ? (
              <a
                href={`/api/shops/${shopId}/import/excel-map/jobs/${activeJobId}/download`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3.5 py-2 text-xs font-medium shadow-sm hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" />
                Download mapped CSV
              </a>
            ) : null}
          </div>
          {errorCount > 0 ? (
            <p className="text-xs text-destructive">
              Fix rows with warnings before import.
            </p>
          ) : null}
          {errorMessage ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
