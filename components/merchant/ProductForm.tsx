import Link from "next/link";
import { createMerchantProductAction } from "@/app/merchant/products/new/actions";
import { CreateProductSubmitButton } from "@/components/merchant/CreateProductSubmitButton";
import { NamedMetafieldWidget } from "@/components/merchant/MetafieldWidget";
import { MetafieldEditorScripts } from "@/components/merchant/MetafieldEditorScripts";
import { ProductImagesField } from "@/components/merchant/ProductImagesField";
import { metafieldTypeLabel } from "@/lib/metafields/display";
import { metafieldColumnKey } from "@/lib/metafields/types";
import { isUnsupportedMetafieldType } from "@/lib/metafields/validators";
import type { ShopLocation } from "@/lib/inventory/types";
import type { MetafieldDefinitionNode } from "@/types/shopify";

interface ProductFormProps {
  shopId: string;
  shopName: string;
  productTypes: string[];
  locations: ShopLocation[];
  definitions: MetafieldDefinitionNode[];
  returnTo?: string;
  flash?: { saved?: string; error?: string; created?: string };
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

/**
 * Server Component form using Server Action (POST).
 * Route /merchant/products/create still accepts POST as fallback; GET redirects here.
 */
export function ProductForm({
  shopId: _shopId,
  shopName,
  productTypes,
  locations,
  definitions,
  returnTo = "/merchant/products/new",
  flash,
}: ProductFormProps) {
  const editableDefinitions = definitions.filter(
    (definition) => !isUnsupportedMetafieldType(definition.type.name),
  );
  const activeLocations = locations.filter((location) => location.isActive);
  const defaultLocationId = activeLocations[0]?.id ?? "";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">New product</h1>
          <p className="mt-1 text-sm text-muted-foreground">{shopName}</p>
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
      {flash?.saved || flash?.created ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          Product created
          {flash.created && flash.created !== "1" ? `: ${flash.created}` : ""}.
        </p>
      ) : null}

      <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Metafields use simple controls (tags, color, date, Yes/No) — no JSON typing.
        Status Active + Publish = visible on sales channels.
      </p>

      <form
        id="merchant-product-create-form"
        action={createMerchantProductAction}
        className="space-y-4 rounded-xl border border-border bg-card p-4"
      >
        <input type="hidden" name="returnTo" value={returnTo} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Title *</span>
          <input
            name="title"
            required
            className={inputClassName}
            placeholder="Product title"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Handle</span>
          <input
            name="handle"
            className={inputClassName}
            placeholder="auto from title if empty"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Description</span>
          <textarea
            name="descriptionHtml"
            className={`${inputClassName} min-h-[96px] resize-y`}
            placeholder="HTML allowed"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Product type</span>
            {productTypes.length > 0 ? (
              <select name="productType" className={inputClassName} defaultValue="">
                <option value="">—</option>
                {productTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            ) : (
              <input name="productType" className={inputClassName} />
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Vendor</span>
            <input name="vendor" className={inputClassName} />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Status</span>
            <select name="status" className={inputClassName} defaultValue="ACTIVE">
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm sm:pt-6">
            <input
              type="checkbox"
              name="publish"
              value="true"
              defaultChecked
              className="size-4"
            />
            <span>Publish to sales channels</span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Price</span>
            <input
              name="price"
              className={inputClassName}
              placeholder="0.00"
              inputMode="decimal"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Compare-at price</span>
            <input
              name="compareAtPrice"
              className={inputClassName}
              placeholder="0.00"
              inputMode="decimal"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">SKU</span>
            <input name="sku" className={inputClassName} />
          </label>

          <ProductImagesField />
        </div>

        <fieldset className="space-y-3 border-t border-border pt-4">
          <legend className="text-sm font-medium">Inventory</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="trackInventory"
              value="true"
              defaultChecked
              className="size-4"
            />
            <span>Track quantity</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Location</span>
              <select
                name="locationId"
                className={inputClassName}
                defaultValue={defaultLocationId}
              >
                {activeLocations.length === 0 ? (
                  <option value="">No locations</option>
                ) : (
                  activeLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Available quantity</span>
              <input
                name="inventoryQuantity"
                type="number"
                min={0}
                step={1}
                className={inputClassName}
                placeholder="0"
                defaultValue={0}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-muted-foreground">When sold out</span>
              <select
                name="inventoryPolicy"
                className={inputClassName}
                defaultValue="DENY"
              >
                <option value="DENY">Stop selling (DENY)</option>
                <option value="CONTINUE">Continue selling (CONTINUE)</option>
              </select>
            </label>
          </div>
        </fieldset>

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
          <CreateProductSubmitButton />
          <Link href="/merchant/products" className="mf-btn">
            Cancel
          </Link>
        </div>
      </form>
      <MetafieldEditorScripts />
    </div>
  );
}
