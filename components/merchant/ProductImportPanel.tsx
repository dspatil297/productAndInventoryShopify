import Link from "next/link";

import { prepareImportDataAction } from "@/app/merchant/import/actions";

import { AiImportSection } from "@/components/merchant/AiImportSection";
import { ImportJobAutoRefresh } from "@/components/merchant/ImportJobAutoRefresh";

import type { ExcelMapJobPublic } from "@/lib/import/excel-map-jobs";

import {

  metafieldImportHint,

  metafieldTypeLabel,

} from "@/lib/metafields/display";

import { metafieldColumnKey } from "@/lib/metafields/types";

import { isUnsupportedMetafieldType } from "@/lib/metafields/validators";

import type { MetafieldDefinitionNode } from "@/types/shopify";



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

  "flex flex-1 items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors";

const TAB_ACTIVE = "bg-background text-foreground shadow-sm";

const TAB_IDLE = "text-muted-foreground hover:text-foreground";



export function ProductImportPanel({

  shopId,

  shopName,

  definitions,

  systemPrompt,

  promptPackVersion,

  promptPackBuiltAt,

  initialTab = "csv",

  jobId,

  initialJob,

  flash,

}: ProductImportPanelProps) {

  const activeTab = initialTab === "ai" ? "ai" : "csv";
  const jobStillRunning =
    Boolean(jobId) &&
    (initialJob?.status === "queued" ||
      initialJob?.status === "processing" ||
      initialJob?.status === "importing");

  const hintRows = definitions.filter(

    (definition) => !isUnsupportedMetafieldType(definition.type.name),

  );



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

          {flash.mapped

            ? ` from ${flash.mapped} mapped row${flash.mapped === "1" ? "" : "s"}`

            : ""}

          .

        </p>

      ) : null}

      {flash?.promptSaved ? (

        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">

          System prompt saved.

        </p>

      ) : null}

      {flash?.promptRegenerated ? (

        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">

          System prompt regenerated from store schema.

        </p>

      ) : null}

      {flash?.prepared ? (

        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">

          Import columns refreshed

          {flash.defs ? ` (${flash.defs} metafield definitions)` : ""}.

        </p>

      ) : null}



      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">

        <h2 className="text-sm font-medium">Setup</h2>

        <p className="text-sm text-muted-foreground">

          Refresh import columns before your first import (metafield defs + system

          prompt pack).

        </p>

        <form action={prepareImportDataAction}>

          <input type="hidden" name="returnTo" value="/merchant/import?tab=ai" />

          <button type="submit" className="mf-btn text-xs">

            Refresh import columns

          </button>

        </form>

        {promptPackVersion ? (

          <p className="text-xs text-muted-foreground">

            Import pack <code className="text-xs">{promptPackVersion}</code>

            {promptPackBuiltAt

              ? ` · ${new Date(promptPackBuiltAt).toLocaleDateString()}`

              : ""}

          </p>

        ) : null}

      </section>



      <div className="flex flex-col gap-4">

        <nav

          aria-label="Import method"

          className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1"

        >

          <Link

            href="/merchant/import?tab=csv"

            className={`${TAB_CLASS} ${activeTab === "csv" ? TAB_ACTIVE : TAB_IDLE}`}

            aria-current={activeTab === "csv" ? "page" : undefined}

          >

            CSV import

          </Link>

          <Link

            href="/merchant/import?tab=ai"

            className={`${TAB_CLASS} ${activeTab === "ai" ? TAB_ACTIVE : TAB_IDLE}`}

            aria-current={activeTab === "ai" ? "page" : undefined}

          >

            AI import

          </Link>

        </nav>



        {activeTab === "csv" ? (

          <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">

            <p className="text-sm text-muted-foreground">

              Download the store template, fill it in Excel or Sheets, then upload

              CSV. Use <code className="text-xs">template_suffix</code> per row

              for product page template (empty = default).

            </p>

            <a

              href={`/api/shops/${shopId}/import/template`}

              className="mf-btn inline-flex w-fit"

            >

              Download template CSV

            </a>

            <form

              method="POST"

              action={`/api/shops/${shopId}/import`}

              encType="multipart/form-data"

              className="flex flex-col gap-3 border-t border-border pt-3"

            >

              <input

                type="hidden"

                name="returnTo"

                value="/merchant/import?tab=csv"

              />

              <label className="flex flex-col gap-1 text-sm">

                <span className="text-muted-foreground">CSV file</span>

                <input

                  name="file"

                  type="file"

                  accept=".csv,text/csv"

                  required

                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"

                />

              </label>

              <button type="submit" className="mf-btn-primary">

                Import products from CSV

              </button>

            </form>

          </section>

        ) : (
          <>
            <ImportJobAutoRefresh active={jobStillRunning} />
            <AiImportSection
              key={
                jobId
                  ? `${jobId}-${initialJob?.status ?? "pending"}`
                  : "ai-import"
              }
              shopId={shopId}
              systemPrompt={systemPrompt}
              promptPackVersion={promptPackVersion}
              jobId={jobId}
              initialJob={initialJob}
            />
          </>
        )}

      </div>



      {hintRows.length > 0 ? (

        <details className="rounded-xl border border-border bg-card p-4">

          <summary className="cursor-pointer text-sm font-medium">

            Metafield column tips

          </summary>

          <p className="mt-2 text-xs text-muted-foreground">

            Same rules as product create forms — no JSON array encoding.

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

                  <span className="font-medium">

                    {definition.name}{" "}

                    <span className="font-normal text-muted-foreground">

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

