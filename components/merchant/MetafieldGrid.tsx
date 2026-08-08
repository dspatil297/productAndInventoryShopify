"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MetafieldCell } from "@/components/merchant/MetafieldCell";
import {
  postShopMetafields,
  refreshShopMetafieldDefinitions,
  type EmbeddedAuthContext,
} from "@/lib/metafields/client-api";
import {
  buildMetafieldClearFiltersHref,
  buildMetafieldFilterHref,
  buildMetafieldNextPageHref,
  buildMetafieldPreviousPageHref,
  type MetafieldListUrlState,
} from "@/lib/metafields/search-params";
import {
  metafieldColumnKey,
  type MetafieldGridRow,
  type MetafieldsListResponse,
} from "@/lib/metafields/types";
import { isUnsupportedMetafieldType } from "@/lib/metafields/validators";
import { buildEmbeddedApiQuery } from "@/lib/merchant/embedded-context";
import type { MetafieldDefinitionNode } from "@/types/shopify";

interface MetafieldGridProps {
  shopId: string;
  shopName: string;
  data: MetafieldsListResponse;
  listState: MetafieldListUrlState;
  basePath: string;
  embedded?: EmbeddedAuthContext;
}

interface DirtyCell {
  productId: string;
  namespace: string;
  key: string;
  type: string;
  value: string;
}

function dirtyCellKey(productId: string, namespace: string, key: string): string {
  return `${productId}:${namespace}:${key}`;
}

function buildBaselineValues(
  rows: MetafieldGridRow[],
  definitions: MetafieldDefinitionNode[],
): Record<string, string> {
  const baseline: Record<string, string> = {};
  for (const row of rows) {
    for (const definition of definitions) {
      const columnKey = metafieldColumnKey(definition.namespace, definition.key);
      const cellKey = dirtyCellKey(row.productId, definition.namespace, definition.key);
      baseline[cellKey] = row.values[columnKey]?.value ?? "";
    }
  }
  return baseline;
}

export function MetafieldGrid({
  shopId,
  shopName,
  data,
  listState,
  basePath,
  embedded,
}: MetafieldGridProps) {
  const router = useRouter();
  const [baselineValues] = useState(() =>
    buildBaselineValues(data.rows, data.definitions),
  );
  const [rows, setRows] = useState<MetafieldGridRow[]>(data.rows);
  const [definitions] = useState<MetafieldDefinitionNode[]>(data.definitions);
  const [dirtyCells, setDirtyCells] = useState<Record<string, DirtyCell>>({});
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const editableDefinitionCount = definitions.filter(
    (definition) => !isUnsupportedMetafieldType(definition.type.name),
  ).length;
  const dirtyCount = Object.keys(dirtyCells).length;
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
  const exportHref = `/api/shops/${shopId}/metafields/export${buildEmbeddedApiQuery(embedded)}`;

  function updateCellValue(
    productId: string,
    definition: MetafieldDefinitionNode,
    nextValue: string,
  ) {
    if (isUnsupportedMetafieldType(definition.type.name)) {
      return;
    }

    const columnKey = metafieldColumnKey(definition.namespace, definition.key);
    const dirtyKey = dirtyCellKey(productId, definition.namespace, definition.key);
    const baseline = baselineValues[dirtyKey] ?? "";

    setRows((currentRows) =>
      currentRows.map((currentRow) => {
        if (currentRow.productId !== productId) {
          return currentRow;
        }

        return {
          ...currentRow,
          values: {
            ...currentRow.values,
            [columnKey]: {
              ...currentRow.values[columnKey],
              value: nextValue,
            },
          },
        };
      }),
    );

    setCellErrors((current) => {
      if (!(dirtyKey in current)) {
        return current;
      }
      const next = { ...current };
      delete next[dirtyKey];
      return next;
    });

    setDirtyCells((current) => {
      if (nextValue === baseline) {
        if (!(dirtyKey in current)) {
          return current;
        }
        const next = { ...current };
        delete next[dirtyKey];
        return next;
      }

      return {
        ...current,
        [dirtyKey]: {
          productId,
          namespace: definition.namespace,
          key: definition.key,
          type: definition.type.name,
          value: nextValue,
        },
      };
    });
    setSaveMessage(null);
  }

  async function handleSave() {
    const updates = Object.values(dirtyCells).map((cell) => ({
      ownerId: cell.productId,
      namespace: cell.namespace,
      key: cell.key,
      type: cell.type,
      value: cell.value,
    }));

    if (updates.length === 0) {
      setSaveMessage("No changes to save. Edit an editable cell first.");
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);
    setCellErrors({});

    try {
      const result = await postShopMetafields(shopId, updates, embedded);

      if (result.error) {
        setSaveMessage(result.error);
        return;
      }

      const nextErrors: Record<string, string> = {};
      for (const error of result.errors ?? []) {
        nextErrors[
          dirtyCellKey(error.ownerId, error.namespace, error.key)
        ] = error.message;
      }
      setCellErrors(nextErrors);

      if ((result.errors?.length ?? 0) > 0) {
        setSaveMessage(
          `Saved ${result.saved ?? 0} values. ${result.errors?.length ?? 0} cells need fixes.`,
        );
        return;
      }

      setDirtyCells({});
      setSaveMessage(`Saved ${result.saved ?? updates.length} metafield values.`);
      router.refresh();
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRefreshDefinitions() {
    setIsRefreshing(true);
    setSaveMessage(null);

    try {
      const result = await refreshShopMetafieldDefinitions(shopId, embedded);

      if (!result.ok) {
        setSaveMessage(result.error);
        return;
      }

      setDirtyCells({});
      setCellErrors({});
      setSaveMessage(`Metafield definitions refreshed (${result.count}).`);
      router.refresh();
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Refresh failed");
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dirtyCount > 0) {
      const shouldContinue = window.confirm(
        "You have unsaved changes. Search will discard them. Continue?",
      );
      if (!shouldContinue) {
        return;
      }
    }

    const formData = new FormData(event.currentTarget);
    const search = String(formData.get("search") ?? "").trim();
    router.push(
      buildMetafieldFilterHref(
        basePath,
        { first: listState.first, search },
        embedded,
      ),
    );
  }

  function handleNavigate(href: string) {
    if (dirtyCount > 0) {
      const shouldContinue = window.confirm(
        "You have unsaved changes. Paging will discard them. Continue?",
      );
      if (!shouldContinue) {
        return;
      }
    }
    router.push(href);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Metafields</h1>
          <p className="mt-1 text-sm text-muted-foreground">{shopName}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {definitions.length} definitions · {editableDefinitionCount} editable
            {definitions.length - editableDefinitionCount > 0
              ? ` · ${definitions.length - editableDefinitionCount} read-only`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleRefreshDefinitions()}
            disabled={isRefreshing}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            {isRefreshing ? "Refreshing…" : "Refresh definitions"}
          </button>
          <a
            href={exportHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            Export CSV
          </a>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {isSaving
              ? "Saving…"
              : `Save changes${dirtyCount ? ` (${dirtyCount})` : ""}`}
          </button>
        </div>
      </div>

      {dirtyCount > 0 ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          {dirtyCount} unsaved cell{dirtyCount === 1 ? "" : "s"}. Save before paging away.
        </p>
      ) : null}

      {saveMessage ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          {saveMessage}
        </p>
      ) : null}

      <form
        onSubmit={handleFilterSubmit}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
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
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Search
          </button>
          <Link
            href={buildMetafieldClearFiltersHref(basePath, embedded)}
            onClick={(event) => {
              if (dirtyCount === 0) {
                return;
              }
              event.preventDefault();
              handleNavigate(buildMetafieldClearFiltersHref(basePath, embedded));
            }}
            className="rounded-md border border-border px-4 py-2 text-sm"
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
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="sticky left-0 z-10 bg-muted/40 px-4 py-3 font-medium">
                  Product
                </th>
                {definitions.map((definition) => {
                  const isEditable = !isUnsupportedMetafieldType(definition.type.name);
                  return (
                    <th
                      key={definition.id}
                      className={`min-w-[160px] px-4 py-3 font-medium ${isEditable ? "" : "opacity-60"}`}
                      title={`${definition.namespace}.${definition.key} (${definition.type.name})${isEditable ? "" : " — read-only"}`}
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
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={definitions.length + 1}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No products found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.productId}
                    className="border-b border-border last:border-0"
                  >
                    <td className="sticky left-0 z-10 bg-background px-4 py-3 align-top">
                      <div className="font-medium">{row.title}</div>
                      <div className="text-xs text-muted-foreground">{row.handle}</div>
                    </td>
                    {definitions.map((definition) => {
                      const columnKey = metafieldColumnKey(
                        definition.namespace,
                        definition.key,
                      );
                      const value = row.values[columnKey]?.value ?? "";
                      const errorKey = dirtyCellKey(
                        row.productId,
                        definition.namespace,
                        definition.key,
                      );
                      const isDirty = errorKey in dirtyCells;
                      const isEditable = !isUnsupportedMetafieldType(
                        definition.type.name,
                      );

                      return (
                        <td
                          key={`${row.productId}-${definition.id}`}
                          className={`px-4 py-3 align-top ${isDirty ? "bg-amber-100 ring-1 ring-amber-400/60" : ""} ${isEditable ? "" : "opacity-60"}`}
                        >
                          <MetafieldCell
                            definition={definition}
                            value={value}
                            error={cellErrors[errorKey]}
                            onChange={(nextValue) =>
                              updateCellValue(row.productId, definition, nextValue)
                            }
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
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {rows.length} products on this page
          {listState.history.length > 0
            ? ` · page ${listState.history.length + 1}`
            : ""}
        </span>
        <div className="flex gap-2">
          {previousHref ? (
            <button
              type="button"
              onClick={() => handleNavigate(previousHref)}
              className="rounded-md border border-border px-3 py-1.5"
            >
              Previous
            </button>
          ) : (
            <span className="rounded-md border border-border px-3 py-1.5 opacity-50">
              Previous
            </span>
          )}
          {nextHref ? (
            <button
              type="button"
              onClick={() => handleNavigate(nextHref)}
              className="rounded-md border border-border px-3 py-1.5"
            >
              Next
            </button>
          ) : (
            <span className="rounded-md border border-border px-3 py-1.5 opacity-50">
              Next
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
