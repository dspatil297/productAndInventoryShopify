import Link from "next/link";
import { MetafieldField } from "@/components/merchant/MetafieldField";
import { MetafieldEditorScripts } from "@/components/merchant/MetafieldEditorScripts";
import {
  buildMetafieldClearFiltersHref,
  buildMetafieldNextPageHref,
  buildMetafieldPreviousPageHref,
  type MetafieldListUrlState,
} from "@/lib/metafields/search-params";
import {
  metafieldColumnKey,
  type MetafieldsListResponse,
} from "@/lib/metafields/types";
import { isUnsupportedMetafieldType } from "@/lib/metafields/validators";
import { buildEmbeddedApiQuery } from "@/lib/merchant/embedded-context";
import type { EmbeddedAuthContext } from "@/lib/merchant/embedded-context";

interface MetafieldSpreadsheetProps {
  shopId: string;
  shopName: string;
  data: MetafieldsListResponse;
  listState: MetafieldListUrlState;
  basePath: string;
  returnTo: string;
  embedded?: EmbeddedAuthContext;
  flash?: {
    saved?: string;
    refreshed?: string;
    error?: string;
  };
}

export function MetafieldSpreadsheet({
  shopId,
  shopName,
  data,
  listState,
  basePath,
  returnTo,
  embedded,
  flash,
}: MetafieldSpreadsheetProps) {
  const definitions = data.definitions;
  const editableDefinitionCount = definitions.filter(
    (definition) => !isUnsupportedMetafieldType(definition.type.name),
  ).length;
  const exportHref = `/api/shops/${shopId}/metafields/export${buildEmbeddedApiQuery(embedded)}`;
  const embeddedQuery = buildEmbeddedApiQuery(embedded);
  const refreshAction = `/api/shops/${shopId}/metafield-definitions/refresh${embeddedQuery}`;
  const saveAction = `/api/shops/${shopId}/metafields/save${embeddedQuery}`;
  const previousHref = buildMetafieldPreviousPageHref(basePath, listState, embedded);
  const nextHref =
    data.pageInfo.hasNextPage && data.pageInfo.endCursor
      ? buildMetafieldNextPageHref(
          basePath,
          listState,
          data.pageInfo.endCursor,
          embedded,
        )
      : null;

  let cellIndex = 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-display text-3xl tracking-tight text-foreground">
              Metafields
            </h1>
            <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {shopName}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {definitions.length} definitions · {editableDefinitionCount} editable
            {definitions.length - editableDefinitionCount > 0
              ? ` · ${definitions.length - editableDefinitionCount} read-only`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form method="POST" action={refreshAction}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <button type="submit" className="mf-btn">
              Refresh definitions
            </button>
          </form>
          <a
            href={exportHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mf-btn inline-block"
          >
            Export CSV
          </a>
        </div>
      </div>

      {flash?.saved ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm">
          Saved {flash.saved} metafield value{flash.saved === "1" ? "" : "s"}.
        </p>
      ) : null}

      {flash?.refreshed ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm">
          Metafield definitions refreshed.
        </p>
      ) : null}

      {flash?.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {flash.error}
        </p>
      ) : null}

      <form method="GET" action={basePath} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
        {embedded?.shop ? (
          <input type="hidden" name="shop" value={embedded.shop} />
        ) : null}
        {embedded?.host ? (
          <input type="hidden" name="host" value={embedded.host} />
        ) : null}
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Search products</span>
          <input
            name="search"
            className="rounded-md border border-border bg-background px-3 py-2"
            defaultValue={listState.search}
            placeholder="Title or handle"
          />
        </label>
        <div className="flex gap-2">
          <button type="submit" className="mf-btn-primary">
            Search
          </button>
          <Link
            href={buildMetafieldClearFiltersHref(basePath, embedded)}
            className="mf-btn inline-block"
          >
            Clear
          </Link>
        </div>
      </form>

      {definitions.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No product metafield definitions for this store. Run{" "}
          <strong>Refresh definitions</strong> or sync store config from the agency
          dashboard.
        </div>
      ) : (
        <form method="POST" action={saveAction} className="space-y-4">
          <input type="hidden" name="returnTo" value={returnTo} />

          <div className="flex justify-end">
            <button type="submit" className="mf-btn-primary">
              Save changes on this page
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="sticky left-0 z-10 bg-muted/40 px-4 py-3 font-medium">
                    Product
                  </th>
                  {definitions.map((definition) => {
                    const isEditable = !isUnsupportedMetafieldType(
                      definition.type.name,
                    );
                    return (
                      <th
                        key={definition.id}
                        className={`min-w-[160px] px-4 py-3 font-medium ${isEditable ? "" : "opacity-60"}`}
                        title={`${definition.namespace}.${definition.key} (${definition.type.name})`}
                      >
                        <div>{definition.name}</div>
                        <div className="text-xs font-normal text-muted-foreground">
                          {definition.namespace}.{definition.key}
                          {!isEditable ? " · read-only" : ""}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={definitions.length + 1}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No products found.
                    </td>
                  </tr>
                ) : (
                  data.rows.map((row) => (
                    <tr
                      key={row.productId}
                      className="border-b border-border last:border-0"
                    >
                      <td className="sticky left-0 z-10 bg-background px-4 py-3 align-top">
                        <div className="font-medium">{row.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.handle}
                        </div>
                      </td>
                      {definitions.map((definition) => {
                        const columnKey = metafieldColumnKey(
                          definition.namespace,
                          definition.key,
                        );
                        const defaultValue = row.values[columnKey]?.value ?? "";
                        const isEditable = !isUnsupportedMetafieldType(
                          definition.type.name,
                        );
                        const index = cellIndex;
                        cellIndex += 1;

                        return (
                          <td
                            key={`${row.productId}-${definition.id}`}
                            className={`px-4 py-3 align-top ${isEditable ? "" : "opacity-60"}`}
                          >
                            <MetafieldField
                              index={index}
                              definition={definition}
                              ownerId={row.productId}
                              defaultValue={defaultValue}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-card/95 p-4 shadow-lg backdrop-blur">
            <div className="text-sm">
              <span className="font-semibold text-foreground">Save Metafield Edits</span>
              <span className="ml-2 text-muted-foreground">Changes on this page must be saved before leaving.</span>
            </div>
            <button type="submit" className="mf-btn-primary shadow-sm">
              Save changes on this page
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {data.rows.length} products on this page
          {listState.history.length > 0
            ? ` · page ${listState.history.length + 1}`
            : ""}
        </span>
        <div className="flex gap-2">
          {previousHref ? (
            <Link
              href={previousHref}
              className="mf-btn inline-block"
            >
              Previous
            </Link>
          ) : (
            <span className="mf-btn opacity-50">
              Previous
            </span>
          )}
          {nextHref ? (
            <Link href={nextHref} className="mf-btn inline-block">
              Next
            </Link>
          ) : (
            <span className="mf-btn opacity-50">
              Next
            </span>
          )}
        </div>
      </div>

      <MetafieldEditorScripts />
      <script src="/metafield-dirty.js" defer suppressHydrationWarning />
    </div>
  );
}
