import Link from "next/link";
import {
  ArrowRightLeft,
  Download,
  MapPin,
  Minus,
  Package,
  Plus,
  Search,
} from "lucide-react";
import { InventorySelectionBoot } from "@/components/merchant/InventorySelectionBoot";
import { LocationSwitcher } from "@/components/merchant/LocationSwitcher";
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
    return "text-muted-foreground";
  }
  if (available <= 0) {
    return "text-red-600 dark:text-red-400";
  }
  if (available <= threshold) {
    return "text-amber-600 dark:text-amber-400";
  }
  return "text-emerald-600 dark:text-emerald-400";
}

function getStockBadge(row: InventoryRow, threshold: number): {
  label: string;
  className: string;
} {
  const available = row.quantities.available;
  if (!row.tracked) {
    return {
      label: "Untracked",
      className:
        "border-amber-500/40 bg-amber-500/90 text-white dark:bg-amber-600/90",
    };
  }
  if (available === null) {
    return {
      label: "Unstocked",
      className:
        "border-border bg-background/90 text-muted-foreground",
    };
  }
  if (available <= 0) {
    return {
      label: "Out of stock",
      className: "border-red-600/40 bg-red-600/90 text-white",
    };
  }
  if (available <= threshold) {
    return {
      label: `Low (${available})`,
      className: "border-amber-500/40 bg-amber-500/90 text-white",
    };
  }
  return {
    label: "In stock",
    className: "border-emerald-600/30 bg-emerald-600/90 text-white",
  };
}

function InventoryCard({
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
  const badge = getStockBadge(row, threshold);

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-border bg-muted/40">
        {row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.imageUrl}
            alt={row.imageAlt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground/60">
            <Package className="h-9 w-9 stroke-[1.5]" />
            <span className="text-[11px] font-medium uppercase tracking-wider">
              No image
            </span>
          </div>
        )}

        <label className="absolute top-2.5 left-2.5 flex cursor-pointer items-center justify-center rounded-md border border-border/70 bg-background/90 p-1.5 shadow-xs backdrop-blur-xs">
          <input
            type="checkbox"
            data-inv-pick="1"
            data-inv-id={row.inventoryItemId}
            data-inv-value={pickValue}
            className="h-4 w-4 cursor-pointer accent-foreground"
            aria-label={`Select ${row.productTitle}`}
          />
        </label>

        <span
          className={`absolute top-2.5 right-2.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium shadow-xs backdrop-blur-xs ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3.5">
        <div className="space-y-1">
          <h2
            className="line-clamp-2 text-sm font-semibold leading-snug text-foreground"
            title={row.productTitle}
          >
            {row.productTitle}
          </h2>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {row.variantTitle && row.variantTitle !== "Default Title" ? (
              <span className="font-medium text-foreground/80">
                {row.variantTitle}
              </span>
            ) : (
              <span>Default Title</span>
            )}
            {row.productType ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                  {row.productType}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">SKU</span>
          <span className="truncate rounded border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] text-foreground">
            {row.sku || "—"}
          </span>
        </div>

        <div className="mt-auto grid grid-cols-3 gap-1.5 rounded-lg border border-border/70 bg-muted/30 p-2 text-center">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Avail
            </div>
            <div
              className={`mt-0.5 text-sm font-semibold tabular-nums ${quantityClass(available, threshold)}`}
            >
              {available ?? "—"}
            </div>
          </div>
          <div className="border-x border-border/60">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              On hand
            </div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
              {row.quantities.onHand ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Comm.
            </div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
              {row.quantities.committed ?? "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-muted/20 p-3">
        {!row.tracked ? (
          <p className="mb-2 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            Tracking off — click Enable &amp; Set
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <form
            method="POST"
            action={setAction}
            className="flex min-w-0 flex-1 items-center gap-1.5"
          >
            <input type="hidden" name="returnTo" value={returnTo} />
            <input
              type="hidden"
              name="inventoryItemId"
              value={row.inventoryItemId}
            />
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
              className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums"
              defaultValue={available ?? 0}
              required
              aria-label={`Quantity for ${row.productTitle}`}
            />
            <button
              type="submit"
              className="mf-btn truncate px-2.5 py-1 text-xs font-medium"
            >
              {row.tracked ? "Set" : "Enable & Set"}
            </button>
          </form>

          <div className="flex items-center gap-1">
            <form method="POST" action={adjustAction}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <input
                type="hidden"
                name="inventoryItemId"
                value={row.inventoryItemId}
              />
              <input type="hidden" name="locationId" value={locationId} />
              <input type="hidden" name="delta" value="-1" />
              <button
                type="submit"
                className="mf-btn inline-flex h-8 w-8 shrink-0 items-center justify-center !p-0 text-foreground"
                aria-label="Decrease by 1"
                title="Decrease by 1"
              >
                <Minus className="h-4 w-4 stroke-[2.25]" />
              </button>
            </form>
            <form method="POST" action={adjustAction}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <input
                type="hidden"
                name="inventoryItemId"
                value={row.inventoryItemId}
              />
              <input type="hidden" name="locationId" value={locationId} />
              <input type="hidden" name="delta" value="1" />
              <button
                type="submit"
                className="mf-btn inline-flex h-8 w-8 shrink-0 items-center justify-center !p-0 text-foreground"
                aria-label="Increase by 1"
                title="Increase by 1"
              >
                <Plus className="h-4 w-4 stroke-[2.25]" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </article>
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

  const lowCount = data.rows.filter(
    (r) =>
      r.quantities.available !== null &&
      r.quantities.available > 0 &&
      r.quantities.available <= data.lowStockThreshold,
  ).length;
  const outCount = data.rows.filter(
    (r) => r.quantities.available !== null && r.quantities.available <= 0,
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-display text-3xl tracking-tight text-foreground">
              Inventory
            </h1>
            <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {shopName}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {data.locationName || "No location selected"}
            </span>
            <span aria-hidden="true">·</span>
            <span>Low stock ≤ {data.lowStockThreshold}</span>
            <span aria-hidden="true">·</span>
            <span>{data.rows.length} shown</span>
            {lowCount > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {lowCount} low
                </span>
              </>
            ) : null}
            {outCount > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-red-600 dark:text-red-400">
                  {outCount} out
                </span>
              </>
            ) : null}
          </div>
        </div>
        <a
          href={exportHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mf-btn inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </a>
      </div>

      {flash?.saved ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm">
          Updated {flash.saved} inventory row{flash.saved === "1" ? "" : "s"}.
        </p>
      ) : null}

      {flash?.error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
          {flash.error}
        </p>
      ) : null}

      {/* Native GET form — works even if client JS fails to hydrate */}
      <form
        method="GET"
        action={basePath}
        className="rounded-xl border border-border bg-card p-3.5 shadow-xs"
      >
        <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-end">
          <LocationSwitcher
            locations={locations}
            selectedLocationId={data.locationId || listState.locationId}
          />
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs">
            <span className="font-medium text-muted-foreground">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                name="search"
                className="w-full rounded-md border border-border bg-background py-2 pr-3 pl-8 text-sm"
                defaultValue={listState.search}
                placeholder="SKU, variant, or product"
              />
            </div>
          </label>
          <label className="flex min-w-[140px] flex-col gap-1 text-xs">
            <span className="font-medium text-muted-foreground">
              Product type
            </span>
            <select
              name="productType"
              className="rounded-md border border-border bg-background px-2.5 py-2 text-sm"
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
          <label className="flex min-w-[120px] flex-col gap-1 text-xs">
            <span className="font-medium text-muted-foreground">Tracking</span>
            <select
              name="tracked"
              className="rounded-md border border-border bg-background px-2.5 py-2 text-sm"
              defaultValue={listState.tracked}
            >
              <option value="all">All</option>
              <option value="tracked">Tracked</option>
              <option value="untracked">Untracked</option>
            </select>
          </label>
          <label className="flex min-w-[130px] flex-col gap-1 text-xs">
            <span className="font-medium text-muted-foreground">Stock</span>
            <select
              name="stock"
              className="rounded-md border border-border bg-background px-2.5 py-2 text-sm"
              defaultValue={listState.stock}
            >
              <option value="all">All</option>
              <option value="in_stock">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
              <option value="unstocked">Not at location</option>
            </select>
          </label>
          <label className="flex min-w-[84px] flex-col gap-1 text-xs">
            <span className="font-medium text-muted-foreground">Show</span>
            <select
              name="first"
              className="rounded-md border border-border bg-background px-2.5 py-2 text-sm"
              defaultValue={String(listState.first)}
            >
              {INVENTORY_PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button type="submit" className="mf-btn-primary py-2">
              Filter
            </button>
            {inventoryHasActiveFilters(listState) ? (
              <Link
                href={filterClearHref}
                className="mf-btn inline-block py-2 text-center"
              >
                Clear
              </Link>
            ) : null}
          </div>
        </div>
      </form>

      {/* Bulk command bar — picks injected from sessionStorage on submit */}
      <form
        id={BULK_FORM_ID}
        method="POST"
        action={setAction}
        className="flex flex-col gap-2.5 rounded-xl border border-border bg-muted/30 p-3.5"
      >
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="locationId" value={data.locationId} />
        <input type="hidden" name="bulk" value="1" />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <InventorySelectionBoot
            storageKey={`inv-sel:${shopId}:${data.locationId}`}
            rowCount={data.rows.length}
          />
        </div>

        <div className="flex flex-col gap-2.5 border-t border-border/70 pt-2.5 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-muted-foreground">
                Bulk set qty
              </span>
              <input
                name="quantity"
                type="number"
                min={0}
                defaultValue={0}
                className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
              />
            </label>
            <button
              type="submit"
              className="mf-btn py-1.5"
              name="bulkAction"
              value="set"
            >
              Set selected
            </button>
            <button
              type="submit"
              className="mf-btn py-1.5"
              name="bulkAction"
              value="enable"
              formNoValidate
            >
              Enable tracking
            </button>
            <button
              type="submit"
              className="mf-btn py-1.5"
              formAction={adjustAction}
              formNoValidate
              name="delta"
              value="-1"
            >
              −1 selected
            </button>
            <button
              type="submit"
              className="mf-btn py-1.5"
              formAction={adjustAction}
              formNoValidate
              name="delta"
              value="1"
            >
              +1 selected
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-2 border-t border-border/60 pt-2.5 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-4">
            <label className="flex min-w-[180px] flex-col gap-1 text-xs">
              <span className="font-medium text-muted-foreground">
                Move to location
              </span>
              <select
                name="toLocationId"
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
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
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-muted-foreground">
                Move qty
              </span>
              <input
                name="moveQuantity"
                type="number"
                min={1}
                placeholder="all avail."
                className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <button
              type="submit"
              className="mf-btn inline-flex items-center gap-1.5 py-1.5"
              formAction={moveAction}
              formNoValidate
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Move selected
            </button>
          </div>
        </div>
      </form>

      {data.rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-16 text-center">
          <Package className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">
            No variants match these filters
          </p>
          <p className="text-xs text-muted-foreground">
            Try clearing search or changing location/stock filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {data.rows.map((row) => (
            <InventoryCard
              key={row.variantId}
              row={row}
              locationId={data.locationId}
              returnTo={returnTo}
              threshold={data.lowStockThreshold}
              setAction={setAction}
              adjustAction={adjustAction}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
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
