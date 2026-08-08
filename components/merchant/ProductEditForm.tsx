import Link from "next/link";
import { updateMerchantProductAction } from "@/app/merchant/products/[id]/actions";
import type { ProductEditData } from "@/lib/products/get-product";
import { NamedMetafieldWidget } from "@/components/merchant/MetafieldWidget";
import { MetafieldEditorScripts } from "@/components/merchant/MetafieldEditorScripts";
import { metafieldTypeLabel } from "@/lib/metafields/display";
import { metafieldColumnKey } from "@/lib/metafields/types";
import { isUnsupportedMetafieldType } from "@/lib/metafields/validators";
import type { MetafieldDefinitionNode } from "@/types/shopify";

interface ProductEditFormProps {
  shopName: string;
  product: ProductEditData;
  productTypes: string[];
  definitions: MetafieldDefinitionNode[];
  returnTo: string;
  flash?: { saved?: string; error?: string };
}

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

function MetafieldLabel({
  name,
  columnKey,
  typeName,
}: {
  name: string;
  columnKey: string;
  typeName: string;
}) {
  return (
    <span className="text-muted-foreground">
      {name} <span className="opacity-60">({columnKey})</span>
      <span
        className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-foreground/70"
        title={typeName}
      >
        {metafieldTypeLabel(typeName)}
      </span>
    </span>
  );
}

export function ProductEditForm({
  shopName,
  product,
  productTypes,
  definitions,
  returnTo,
  flash,
}: ProductEditFormProps) {
  const editableDefinitions = definitions.filter(
    (definition) => !isUnsupportedMetafieldType(definition.type.name),
  );
  const variant = product.variant;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Edit product</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {shopName} · {product.handle}
          </p>
        </div>
        <Link href="/merchant/products" className="mf-btn">
          Back to products
        </Link>
      </div>

      {flash?.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {flash.error}
        </p>
      ) : null}
      {flash?.saved ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          Product saved. Preview refreshes with storefront data.
        </p>
      ) : null}

      <form
        id="merchant-product-edit-form"
        action={updateMerchantProductAction}
        className="space-y-4 rounded-xl border border-border bg-card p-4"
      >
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="productId" value={product.id} />
        <input type="hidden" name="variantId" value={variant?.id ?? ""} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Title *</span>
          <input
            name="title"
            required
            className={inputClassName}
            defaultValue={product.title}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Handle</span>
          <input
            name="handle"
            className={inputClassName}
            defaultValue={product.handle}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Description</span>
          <textarea
            name="descriptionHtml"
            className={`${inputClassName} min-h-[96px] resize-y`}
            defaultValue={product.descriptionHtml}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Product type</span>
            {productTypes.length > 0 ? (
              <select
                name="productType"
                className={inputClassName}
                defaultValue={product.productType}
              >
                <option value="">—</option>
                {productTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
                {product.productType &&
                !productTypes.includes(product.productType) ? (
                  <option value={product.productType}>
                    {product.productType}
                  </option>
                ) : null}
              </select>
            ) : (
              <input
                name="productType"
                className={inputClassName}
                defaultValue={product.productType}
              />
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Vendor</span>
            <input
              name="vendor"
              className={inputClassName}
              defaultValue={product.vendor}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Status</span>
            <select
              name="status"
              className={inputClassName}
              defaultValue={product.status}
            >
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Price</span>
            <input
              name="price"
              className={inputClassName}
              defaultValue={variant?.price ?? ""}
              inputMode="decimal"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Compare-at price</span>
            <input
              name="compareAtPrice"
              className={inputClassName}
              defaultValue={variant?.compareAtPrice ?? ""}
              inputMode="decimal"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">SKU</span>
            <input
              name="sku"
              className={inputClassName}
              defaultValue={variant?.sku ?? ""}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">When sold out</span>
            <select
              name="inventoryPolicy"
              className={inputClassName}
              defaultValue={variant?.inventoryPolicy ?? "DENY"}
            >
              <option value="DENY">Stop selling (DENY)</option>
              <option value="CONTINUE">Continue selling (CONTINUE)</option>
            </select>
          </label>
        </div>

        {editableDefinitions.length > 0 ? (
          <fieldset className="space-y-3 border-t border-border pt-4">
            <legend className="text-sm font-medium">Metafields</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {editableDefinitions.map((definition) => {
                const columnKey = metafieldColumnKey(
                  definition.namespace,
                  definition.key,
                );
                const typeName = definition.type.name;
                const name = `mf[${columnKey}]`;
                const defaultValue = product.metafieldValues[columnKey] ?? "";
                const wide =
                  typeName === "json" ||
                  typeName === "multi_line_text_field" ||
                  typeName.startsWith("list.");

                return (
                  <div
                    key={definition.id}
                    className={`flex flex-col gap-1 text-sm ${wide ? "sm:col-span-2" : ""}`}
                  >
                    <MetafieldLabel
                      name={definition.name}
                      columnKey={columnKey}
                      typeName={typeName}
                    />
                    <NamedMetafieldWidget
                      name={name}
                      typeName={typeName}
                      defaultValue={defaultValue}
                      definition={definition}
                      allowEmptyBoolean
                    />
                  </div>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Save product
          </button>
          <Link href="/merchant/products" className="mf-btn">
            Cancel
          </Link>
        </div>
      </form>
      <MetafieldEditorScripts />
    </div>
  );
}
