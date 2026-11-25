"use client";

import { useState } from "react";
import { AiImportSection } from "@/components/merchant/AiImportSection";
import type { ExcelMapJobPublic } from "@/lib/import/excel-map-jobs";
import {
  metafieldImportHint,
  metafieldTypeLabel,
} from "@/lib/metafields/display";
import { metafieldColumnKey } from "@/lib/metafields/types";
import { isUnsupportedMetafieldType } from "@/lib/metafields/validators";
import type { MetafieldDefinitionNode } from "@/types/shopify";
import { Loader2, RefreshCw } from "lucide-react";

export type ImportTab = "csv" | "ai";

interface ProductImportPanelProps {
  shopId: string;
  shopName: string;
  metafieldColumnCount: number;
  definitions: MetafieldDefinitionNode[];
  systemPrompt: string;
  promptPackVersion?: string | null;
  promptPackBuiltAt?: string | null;
  initialTab?: ImportTab;
  jobId?: string | null;
  initialJob?: ExcelMapJobPublic | null;
  flash?: {
    saved?: string;
    error?: string;
    mapped?: string;
    prepared?: string;
    defs?: string;
    processing?: string;
    promptSaved?: string;
    promptRegenerated?: string;
  };
}

const TAB_CLASS =
  "flex flex-1 items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer select-none";
const TAB_ACTIVE = "bg-background text-foreground shadow-sm font-semibold";
const TAB_IDLE = "text-muted-foreground hover:text-foreground";

export function ProductImportPanel({
  shopId,
  shopName,
  definitions,
  systemPrompt,
  promptPackVersion: initialPackVersion,
  promptPackBuiltAt: _promptPackBuiltAt,
  initialTab = "csv",
  jobId,
  initialJob,
  flash,
}: ProductImportPanelProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>(initialTab);
  const [isRefreshingCols, setIsRefreshingCols] = useState(false);
  const [packVersion, setPackVersion] = useState(initialPackVersion);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  void _promptPackBuiltAt;
  void setPackVersion;

  const hintRows = definitions.filter(
    (definition) => !isUnsupportedMetafieldType(definition.type.name),
  );

  const handleRefreshColumns = async () => {
    if (isRefreshingCols) return;
    setIsRefreshingCols(true);
    setRefreshMessage(null);

    try {
      const response = await fetch(`/api/shops/${shopId}/metafield-definitions/refresh`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to refresh columns");
      }
      setRefreshMessage(`Import columns refreshed (${data.definitions?.length ?? definitions.length} definitions).`);
      setTimeout(() => setRefreshMessage(null), 4000);
    } catch (err) {
      setRefreshMessage(err instanceof Error ? err.message : "Failed to refresh columns");
    } finally {
      setIsRefreshingCols(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Import</h1>
        <p className="mt-1 text-sm text-muted-foreground">{shopName}</p>
      </div>

      {flash?.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {flash.error}
        </p>
      ) : null}

      {flash?.saved ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          Imported {flash.saved} product{flash.saved === "1" ? "" : "s"}
          {flash.mapped ? ` from ${flash.mapped} mapped row${flash.mapped === "1" ? "" : "s"}` : ""}.
        </p>
      ) : null}

      {/* Setup Section */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Setup</h2>
        <p className="text-sm text-muted-foreground">
          Refresh import columns whenever you add or edit metafield definitions in your Shopify admin.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRefreshColumns}
            disabled={isRefreshingCols}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-muted cursor-pointer disabled:opacity-50"
          >
            {isRefreshingCols ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Refreshing columns…
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh import columns
              </>
            )}
          </button>
          {refreshMessage ? (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {refreshMessage}
            </span>
          ) : null}
        </div>
        {packVersion ? (
          <p className="text-xs text-muted-foreground">
            Import pack <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{packVersion}</code>
          </p>
        ) : null}
      </section>

      {/* Tabs */}
      <div className="flex flex-col gap-4">
        <nav
          aria-label="Import method"
          className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1"
        >
          <a
            href="/merchant/import?tab=csv"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab("csv");
              if (typeof window !== "undefined") {
                const url = new URL(window.location.href);
                url.searchParams.set("tab", "csv");
                window.history.replaceState(null, "", url.toString());
              }
            }}
            className={`${TAB_CLASS} ${activeTab === "csv" ? TAB_ACTIVE : TAB_IDLE}`}
            aria-current={activeTab === "csv" ? "page" : undefined}
          >
            Standard CSV (Store Template)
          </a>
          <a
            href="/merchant/import?tab=ai"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab("ai");
              if (typeof window !== "undefined") {
                const url = new URL(window.location.href);
                url.searchParams.set("tab", "ai");
                window.history.replaceState(null, "", url.toString());
              }
            }}
            className={`${TAB_CLASS} ${activeTab === "ai" ? TAB_ACTIVE : TAB_IDLE}`}
            aria-current={activeTab === "ai" ? "page" : undefined}
          >
            AI Smart Import (Vendor Excel/CSV)
          </a>
        </nav>

        <div className={activeTab === "csv" ? "block" : "hidden"}>
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Download the store template, fill it in Excel or Sheets, then upload CSV. Use <code className="text-xs font-mono">template_suffix</code> per row for product page template.
            </p>
            <a
              href={`/api/shops/${shopId}/import/template`}
              className="mf-btn inline-flex w-fit text-xs"
            >
              Download template CSV
            </a>
            <form
              method="POST"
              action={`/api/shops/${shopId}/import`}
              encType="multipart/form-data"
              className="flex flex-col gap-3 border-t border-border pt-3"
            >
              <input type="hidden" name="returnTo" value="/merchant/import?tab=csv" />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground text-xs">CSV file</span>
                <input
                  name="file"
                  type="file"
                  accept=".csv,text/csv"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-xs file:font-medium hover:file:bg-muted/80 cursor-pointer"
                />
              </label>
              <button type="submit" className="mf-btn-primary w-fit text-xs">
                Import products from CSV
              </button>
            </form>
          </section>
        </div>

        <div className={activeTab === "ai" ? "block" : "hidden"}>
          <AiImportSection
            shopId={shopId}
            systemPrompt={systemPrompt}
            promptPackVersion={packVersion}
            jobId={jobId}
            initialJob={initialJob}
          />
        </div>
      </div>

      {/* Metafield tips */}
      {hintRows.length > 0 ? (
        <details className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-medium">
            Metafield column tips
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Same rules as product create forms — no JSON array encoding needed.
          </p>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {hintRows.map((definition) => {
              const columnKey = metafieldColumnKey(
                definition.namespace,
                definition.key,
              );
              return (
                <li
                  key={definition.id}
                  className="flex flex-col gap-0.5 border-b border-border pb-2 last:border-0 last:pb-0"
                >
                  <span className="font-medium text-xs">
                    {definition.name}{" "}
                    <span className="font-normal text-muted-foreground font-mono">
                      ({columnKey})
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {metafieldTypeLabel(definition.type.name)} —{" "}
                    {metafieldImportHint(definition.type.name)}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
