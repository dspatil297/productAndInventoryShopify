"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Package, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { ProductSelectionBoot } from "@/components/merchant/ProductSelectionBoot";
import { DEFAULT_PAGE_SIZE } from "@/lib/products/constants";
import {
  buildClearFiltersHref,
  buildFilterHref,
  buildNextPageHref,
  buildPreviousPageHref,
  type ProductListUrlState,
} from "@/lib/products/search-params";
import type { ProductListItem, ProductsListResponse } from "@/lib/products/types";
import { productEditPath } from "@/lib/products/product-gid";

interface ProductTableProps {
  shopId: string;
  shopName: string;
  productTypes: string[];
  data: ProductsListResponse;
  listState: ProductListUrlState;
  basePath: string;
  returnTo: string;
  embedded?: { shop?: string; host?: string };
  flash?: { saved?: string; error?: string; created?: string; deleted?: string };
}

const BULK_DELETE_FORM_ID = "products-bulk-delete-form";

function statusBadgeClass(status: string): string {
  const upper = status.toUpperCase();
  if (upper === "ACTIVE") {
    return "border-emerald-600/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  }
  if (upper === "DRAFT") {
    return "border-amber-600/25 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  }
  return "border-border bg-muted text-muted-foreground";
}

function buildColumns(allowEdit: boolean): ColumnDef<ProductListItem>[] {
  return [
    {
      id: "image",
      header: "Image",
      cell: ({ row }) =>
        row.original.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.original.imageUrl}
            alt={row.original.imageAlt}
            loading="lazy"
            decoding="async"
            className="h-12 w-12 rounded-lg border border-border bg-muted/40 object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground/60">
            <Package className="h-5 w-5" />
          </div>
        ),
    },
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) =>
        allowEdit ? (
          <Link
            href={productEditPath(row.original.id)}
            className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            {row.original.title}
          </Link>
        ) : (
          <span className="font-medium">{row.original.title}</span>
        ),
    },
    {
      accessorKey: "handle",
      header: "Handle",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.handle}
        </span>
      ),
    },
    {
      accessorKey: "productType",
      header: "Type",
      cell: ({ row }) =>
        row.original.productType && row.original.productType !== "—" ? (
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">
            {row.original.productType}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span
          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusBadgeClass(row.original.status)}`}
        >
          {row.original.status}
        </span>
      ),
    },
    {
      accessorKey: "skus",
      header: "SKU",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-foreground">
          {row.original.skus}
        </span>
      ),
    },
    {
      accessorKey: "priceRange",
      header: "Price",
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">
          {row.original.priceRange}
        </span>
      ),
    },
  ];
}

export function ProductTable({
  shopId,
  shopName,
  productTypes,
  data,
  listState,
  basePath,
  returnTo,
  embedded,
  flash,
}: ProductTableProps) {
  const router = useRouter();
  const { products, pageInfo } = data;
  const columns = useMemo(() => buildColumns(!embedded), [embedded]);
  const deleteAction = `/api/shops/${shopId}/products/delete`;

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const tableClassName = useMemo(
    () => "w-full min-w-[760px] text-left text-sm",
    [],
  );

  const previousHref = buildPreviousPageHref(basePath, listState, embedded);
  const nextHref =
    pageInfo.hasNextPage && pageInfo.endCursor
      ? buildNextPageHref(basePath, listState, pageInfo.endCursor, embedded)
      : null;

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const search = String(formData.get("search") ?? "").trim();
    const productType = String(formData.get("productType") ?? "");

    router.push(
      buildFilterHref(
        basePath,
        { search, productType, first: DEFAULT_PAGE_SIZE },
        embedded,
      ),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-display text-3xl tracking-tight text-foreground">
              Products
            </h1>
            <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {shopName}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {products.length} products on this page
          </p>
        </div>
        {!embedded ? (
          <Link
            href="/merchant/products/new?view=visual"
            className="mf-btn-primary inline-flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New product
          </Link>
        ) : null}
      </div>

      {flash?.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {flash.error}
        </p>
      ) : null}
      {flash?.saved || flash?.created ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          Product created
          {flash.created && flash.created !== "1" ? `: ${flash.created}` : ""}.
        </p>
      ) : null}
      {flash?.deleted ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm">
          Deleted {flash.deleted} product{flash.deleted === "1" ? "" : "s"}.
        </p>
      ) : null}

      <form
        id={BULK_DELETE_FORM_ID}
        method="POST"
        action={deleteAction}
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3.5"
      >
        <input type="hidden" name="returnTo" value={returnTo} />
        <ProductSelectionBoot
          storageKey={`prod-sel:${shopId}`}
          rowCount={products.length}
          formId={BULK_DELETE_FORM_ID}
        />
        <button
          type="submit"
          className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/15"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete selected
        </button>
      </form>

      <form
        onSubmit={handleFilterSubmit}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-xs sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Search</span>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              name="search"
              className="w-full rounded-md border border-border bg-background py-2 pr-3 pl-8 text-sm"
              defaultValue={listState.search}
              placeholder="Title, handle, or SKU"
            />
          </div>
        </label>
        <label className="flex min-w-[180px] flex-col gap-1 text-xs">
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
        <div className="flex gap-2">
          <button type="submit" className="mf-btn-primary py-2">
            Search
          </button>
          <Link
            href={buildClearFiltersHref(basePath, embedded)}
            className="mf-btn inline-block py-2"
          >
            Clear
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
        <table className={tableClassName}>
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-3 font-medium" aria-label="Select" />
              {table.getHeaderGroups()[0]?.headers.map((header) => (
                <th key={header.id} className="px-4 py-3 font-medium">
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  No products found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border transition-colors last:border-0 hover:bg-muted/35"
                >
                  <td className="px-4 py-3 align-middle">
                    <input
                      type="checkbox"
                      data-prod-pick="1"
                      data-prod-id={row.original.id}
                      className="h-4 w-4 cursor-pointer accent-primary"
                      aria-label={`Select ${row.original.title}`}
                    />
                  </td>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {products.length} products on this page
          {listState.history.length > 0
            ? ` · page ${listState.history.length + 1}`
            : ""}
        </span>
        <div className="flex gap-2">
          {previousHref ? (
            <Link
              href={previousHref}
              className="rounded-md border border-border px-3 py-1.5"
            >
              Previous
            </Link>
          ) : (
            <span className="rounded-md border border-border px-3 py-1.5 opacity-50">
              Previous
            </span>
          )}
          {nextHref ? (
            <Link href={nextHref} className="rounded-md border border-border px-3 py-1.5">
              Next
            </Link>
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
