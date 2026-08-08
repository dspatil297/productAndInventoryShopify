import Link from "next/link";
import { LocationSwitcher } from "@/components/merchant/LocationSwitcher";
import { InventorySelectionBoot } from "@/components/merchant/InventorySelectionBoot";
import { INVENTORY_PAGE_SIZE_OPTIONS } from "@/lib/inventory/constants";
import {
  buildInventoryClearFiltersHref,
  buildInventoryNextPageHref,
  buildInventoryPreviousPageHref,
  inventoryHasActiveFilters,
  type InventoryListUrlState,
} from "@/lib/inventory/search-params";
import type {
  InventoryListResponse,
  InventoryRow,
  ShopLocation,
} from "@/lib/inventory/types";

interface InventoryGridProps {
  shopId: string;
  shopName: string;
  locations: ShopLocation[];
  productTypes: string[];
  data: InventoryListResponse;
  listState: InventoryListUrlState;
  basePath: string;
  returnTo: string;
  flash?: {
    saved?: string;
    error?: string;
  };
}

const BULK_FORM_ID = "inventory-bulk-form";

function quantityClass(
  available: number | null,
  threshold: number,
): string {
  if (available === null) {
    return "";
  }
  if (available <= 0) {
    return "text-red-600";
  }
  if (available <= threshold) {
    return "text-amber-600";
  }
  return "";
}

function InventoryRowEditor({
  row,
  locationId,
  returnTo,
  threshold,
  setAction,
  adjustAction,
}: {
  row: InventoryRow;
  locationId: string;
  returnTo: string;
  threshold: number;
  setAction: string;
  adjustAction: string;
}) {
  const available = row.quantities.available;
  const pickValue = JSON.stringify({
    inventoryItemId: row.inventoryItemId,
    changeFromQuantity: available,
  });

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 align-middle">
        <input
          type="checkbox"
          data-inv-pick="1"
          data-inv-id={row.inventoryItemId}
          data-inv-value={pickValue}
          className="h-4 w-4 accent-foreground"
          aria-label={`Select ${row.productTitle}`}
        />
      </td>
      <td className="px-3 py-2 align-top">
        <div className="font-medium">{row.productTitle}</div>
        <div className="text-xs text-muted-foreground">{row.variantTitle}</div>
        {row.productType ? (
          <div className="text-xs text-muted-foreground">{row.productType}</div>
        ) : null}
      </td>
      <td className="px-3 py-2 align-top text-sm">{row.sku ?? "—"}</td>
      <td
        className={`px-3 py-2 align-top text-sm font-medium ${quantityClass(available, threshold)}`}
      >
        {available ?? "—"}
      </td>
      <td className="px-3 py-2 align-top text-sm">{row.quantities.onHand ?? "—"}</td>
      <td className="px-3 py-2 align-top text-sm">{row.quantities.committed ?? "—"}</td>
      <td className="px-3 py-2 align-top">
        <div className="flex flex-col gap-1">
          {!row.tracked ? (
            <span className="text-xs font-medium text-amber-700">
              Tracking off — use Enable &amp; Set or bulk Enable tracking
            </span>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <form method="POST" action={setAction} className="flex items-center gap-1">
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="inventoryItemId" value={row.inventoryItemId} />
              <input type="hidden" name="locationId" value={locationId} />
              <input
                type="hidden"
                name="changeFromQuantity"
                value={available === null ? "" : String(available)}
              />
              <input
                name="quantity"
                type="number"
                min={0}
                className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm"
                defaultValue={available ?? 0}
                required
              />
              <button type="submit" className="mf-btn text-xs">
                {row.tracked ? "Set" : "Enable & Set"}
              </button>
            </form>
            <form method="POST" action={adjustAction}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="inventoryItemId" value={row.inventoryItemId} />
              <input type="hidden" name="locationId" value={locationId} />
              <input type="hidden" name="delta" value="-1" />
              <button type="submit" className="mf-btn text-xs" aria-label="Decrease by 1">
                −1
              </button>
            </form>
            <form method="POST" action={adjustAction}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="inventoryItemId" value={row.inventoryItemId} />
              <input type="hidden" name="locationId" value={locationId} />
              <input type="hidden" name="delta" value="1" />
              <button type="submit" className="mf-btn text-xs" aria-label="Increase by 1">
                +1
              </button>
            </form>
          </div>
        </div>
      </td>
    </tr>
  );
}

export function InventoryGrid({
  shopId,
  shopName,
  locations,
  productTypes,
  data,
  listState,
  basePath,
  returnTo,
  flash,
}: InventoryGridProps) {
  const setAction = `/api/shops/${shopId}/inventory/set`;
  const adjustAction = `/api/shops/${shopId}/inventory/adjust`;
  const moveAction = `/api/shops/${shopId}/inventory/move`;
  const exportHref = `/api/shops/${shopId}/inventory/export?${new URLSearchParams({
    locationId: data.locationId,
    ...(listState.search ? { search: listState.search } : {}),
  }).toString()}`;

  const previousHref = buildInventoryPreviousPageHref(basePath, listState);
  const nextHref =
    data.pageInfo.hasNextPage && data.pageInfo.endCursor
      ? buildInventoryNextPageHref(basePath, listState, data.pageInfo.endCursor)
      : null;

  const filterClearHref = buildInventoryClearFiltersHref(
    basePath,
    data.locationId || listState.locationId,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">{shopName}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.locationName
              ? `${data.locationName} · low stock ≤ ${data.lowStockThreshold}`
              : "No location selected"}
          </p>
        </div>
        <a
          href={exportHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mf-btn inline-block"
        >
          Export CSV
        </a>
      </div>

      {flash?.saved ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm">
          Updated {flash.saved} inventory row{flash.saved === "1" ? "" : "s"}.
        </p>
      ) : null}

      {flash?.error ? (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
          {flash.error}
        </p>
      ) : null}

      {/* Native GET form — works even if client JS fails to hydrate */}
      <form
        method="GET"
        action={basePath}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <LocationSwitcher
            locations={locations}
            selectedLocationId={data.locationId || listState.locationId}
          />
          <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Search</span>
            <input
              name="search"
              className="rounded-md border border-border bg-background px-3 py-2"
              defaultValue={listState.search}
              placeholder="SKU, variant, or product"
            />
          </label>
          <label className="flex min-w-[160px] flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Product type</span>
            <select
              name="productType"
              className="rounded-md border border-border bg-background px-3 py-2"
              defaultValue={listState.productType}
            >
              <option value="">All types</option>
              {productTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[140px] flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Tracking</span>
            <select
              name="tracked"
              className="rounded-md border border-border bg-background px-3 py-2"
              defaultValue={listState.tracked}
            >
              <option value="all">All</option>
              <option value="tracked">Tracked</option>
              <option value="untracked">Untracked</option>
            </select>
          </label>
          <label className="flex min-w-[140px] flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Stock</span>
            <select
              name="stock"
              className="rounded-md border border-border bg-background px-3 py-2"
              defaultValue={listState.stock}
            >
              <option value="all">All</option>
              <option value="in_stock">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
              <option value="unstocked">Not at location</option>
            </select>
          </label>
          <label className="flex min-w-[100px] flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Page size</span>
            <select
              name="first"
              className="rounded-md border border-border bg-background px-3 py-2"
              defaultValue={String(listState.first)}
            >
              {INVENTORY_PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="mf-btn">
            Filter
          </button>
          {inventoryHasActiveFilters(listState) ? (
            <Link
              href={filterClearHref}
              className="mf-btn inline-block text-center"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {/* Bulk form — picks injected from sessionStorage on submit (cross-page) */}
      <form
        id={BULK_FORM_ID}
        method="POST"
        action={setAction}
        className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4"
      >
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="locationId" value={data.locationId} />
        <input type="hidden" name="bulk" value="1" />
        <InventorySelectionBoot
          storageKey={`inv-sel:${shopId}:${data.locationId}`}
          rowCount={data.rows.length}
        />
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Bulk set qty</span>
            <input
              name="quantity"
              type="number"
              min={0}
              defaultValue={0}
              className="w-24 rounded-md border border-border bg-background px-2 py-1"
            />
          </label>
          <button type="submit" className="mf-btn" name="bulkAction" value="set">
            Set selected
          </button>
          <button
            type="submit"
            className="mf-btn"
            name="bulkAction"
            value="enable"
            formNoValidate
          >
            Enable tracking
          </button>
          <button
            type="submit"
            className="mf-btn"
            formAction={adjustAction}
            formNoValidate
            name="delta"
            value="-1"
          >
            −1 selected
          </button>
          <button
            type="submit"
            className="mf-btn"
            formAction={adjustAction}
            formNoValidate
            name="delta"
            value="1"
          >
            +1 selected
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <label className="flex min-w-[200px] flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Move to location</span>
            <select
              name="toLocationId"
              className="rounded-md border border-border bg-background px-3 py-2"
              defaultValue=""
            >
              <option value="" disabled>
                Choose destination…
              </option>
              {locations
                .filter((location) => location.id !== data.locationId)
                .map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                    {location.isActive ? "" : " (inactive)"}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Move qty</span>
            <input
              name="moveQuantity"
              type="number"
              min={1}
              placeholder="all avail."
              className="w-28 rounded-md border border-border bg-background px-2 py-1"
            />
          </label>
          <button
            type="submit"
            className="mf-btn"
            formAction={moveAction}
            formNoValidate
          >
            Move selected
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Change view location via filter Location + Filter. Move selected transfers stock
          from this location to destination (blank Move qty = all available).
        </p>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="w-10 px-3 py-2 font-medium">
                <span className="sr-only">Select</span>
              </th>
              <th className="px-3 py-2 font-medium">Product / variant</th>
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">Available</th>
              <th className="px-3 py-2 font-medium">On hand</th>
              <th className="px-3 py-2 font-medium">Committed</th>
              <th className="px-3 py-2 font-medium">Edit</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No variants match these filters.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => (
                <InventoryRowEditor
                  key={row.variantId}
                  row={row}
                  locationId={data.locationId}
                  returnTo={returnTo}
                  threshold={data.lowStockThreshold}
                  setAction={setAction}
                  adjustAction={adjustAction}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3">
        {previousHref ? (
          <Link href={previousHref} className="mf-btn">
            Previous
          </Link>
        ) : (
          <span />
        )}
        {nextHref ? (
          <Link href={nextHref} className="mf-btn">
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}
