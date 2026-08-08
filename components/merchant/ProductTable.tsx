"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
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

function buildColumns(allowEdit: boolean): ColumnDef<ProductListItem>[] {
  return [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) =>
        allowEdit ? (
          <Link
            href={productEditPath(row.original.id)}
            className="font-medium text-primary hover:underline"
          >
            {row.original.title}
          </Link>
        ) : (
          row.original.title
        ),
    },
    { accessorKey: "handle", header: "Handle" },
    { accessorKey: "productType", header: "Type" },
    { accessorKey: "status", header: "Status" },
    { accessorKey: "skus", header: "SKU" },
    { accessorKey: "priceRange", header: "Price" },
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">{shopName}</p>
        </div>
        {!embedded ? (
          <Link
            href="/merchant/products/new?view=visual"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
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
        className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4"
      >
        <input type="hidden" name="returnTo" value={returnTo} />
        <ProductSelectionBoot
          storageKey={`prod-sel:${shopId}`}
          rowCount={products.length}
          formId={BULK_DELETE_FORM_ID}
        />
        <button
          type="submit"
          className="w-fit rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          Delete selected
        </button>
      </form>

      <form
        onSubmit={handleFilterSubmit}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Search</span>
          <input
            name="search"
            className="rounded-md border border-border bg-background px-3 py-2"
            defaultValue={listState.search}
            placeholder="Title, handle, or SKU"
          />
        </label>
        <label className="flex min-w-[180px] flex-col gap-1 text-sm">
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
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Search
          </button>
          <Link
            href={buildClearFiltersHref(basePath, embedded)}
            className="rounded-md border border-border px-4 py-2 text-sm"
          >
            Clear
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className={tableClassName}>
          <thead className="border-b border-border bg-muted/40">
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
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No products found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 align-top">
                    <input
                      type="checkbox"
                      data-prod-pick="1"
                      data-prod-id={row.original.id}
                      className="h-4 w-4 accent-foreground"
                      aria-label={`Select ${row.original.title}`}
                    />
                  </td>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-top">
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
