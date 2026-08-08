import Link from "next/link";
import { syncThemeTemplatesAction } from "@/app/merchant/products/sync-templates/actions";
import { HeritagePdpCanvas } from "@/components/merchant/HeritagePdpCanvas";
import { ProductImagesField } from "@/components/merchant/ProductImagesField";
import type { ShopLocation } from "@/lib/inventory/types";
import {
  findSyncedTemplateLook,
  type SyncedThemeProductTemplate,
  type SyncedThemeTemplatesState,
} from "@/lib/products/theme-templates";
import { themeSyncScopeError } from "@/lib/shopify/scopes";
import type { MetafieldDefinitionNode } from "@/types/shopify";

export interface VisualProductValues {
  title: string;
  handle: string;
  descriptionHtml: string;
  productType: string;
  vendor: string;
  price: string;
  compareAtPrice: string;
  sku: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  inventoryPolicy: "DENY" | "CONTINUE";
  trackInventory: boolean;
  inventoryQuantity: number | null;
  locationId: string;
  publish: boolean;
  metafieldValues: Record<string, string>;
}

interface VisualProductFlowProps {
  mode: "create" | "edit";
  shopName: string;
  shopScope?: string | null;
  /** Selected Online Store template suffix; null = still on picker. "" = default product.json */
  selectedSuffix: string | null;
  pickHref: string;
  fillBaseHref: string;
  simpleHref: string;
  syncReturnTo: string;
  themeTemplates: SyncedThemeTemplatesState | null;
  action: (formData: FormData) => Promise<void>;
  productTypes: string[];
  locations: ShopLocation[];
  definitions: MetafieldDefinitionNode[];
  values: VisualProductValues;
  productId?: string;
  variantId?: string;
  flash?: {
    error?: string;
    saved?: string;
    created?: string;
    synced?: string;
    templates?: string;
  };
}

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

function suffixHref(fillBaseHref: string, suffix: string | null): string {
  const url = new URL(fillBaseHref, "https://local.invalid");
  url.searchParams.set("view", "visual");
  if (suffix === null || suffix === "") {
    url.searchParams.set("suffix", "");
  } else {
    url.searchParams.set("suffix", suffix);
  }
  url.searchParams.delete("template");
  return `${url.pathname}${url.search}`;
}

function TemplatePicker({
  fillBaseHref,
  simpleHref,
  shopName,
  themeTemplates,
  syncReturnTo,
  flash,
}: {
  fillBaseHref: string;
  simpleHref: string;
  shopName: string;
  themeTemplates: SyncedThemeTemplatesState | null;
  syncReturnTo: string;
  flash?: VisualProductFlowProps["flash"];
}) {
  const templates: SyncedThemeProductTemplate[] =
    themeTemplates?.templates ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Choose product page template</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {shopName} — template list + look (colors/sections) from theme.
            Cached. Sync only when theme changes — not every new product.
          </p>
          {themeTemplates ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Theme: {themeTemplates.themeName} · last sync{" "}
              {new Date(themeTemplates.syncedAt).toLocaleString()}
            </p>
          ) : (
            <p className="mt-1 text-xs text-amber-700">
              No templates cached yet — click Sync templates from theme.
            </p>
          )}
        </div>
        <form action={syncThemeTemplatesAction}>
          <input type="hidden" name="returnTo" value={syncReturnTo} />
          <button type="submit" className="mf-btn text-xs">
            Sync templates from theme
          </button>
        </form>
      </div>

      {flash?.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {flash.error}
        </p>
      ) : null}
      {flash?.synced ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          Synced {flash.templates ?? ""} template(s) + look from theme.
        </p>
      ) : null}

      {templates.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((template) => {
            const swatch = template.look?.colors ?? themeTemplates?.colors;
            return (
              <a
                key={template.filename}
                href={suffixHref(fillBaseHref, template.suffix)}
                className="rounded-xl border border-border bg-card p-4 no-underline transition hover:border-primary"
              >
                <div className="text-base font-semibold text-foreground">
                  {template.label}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {template.filename}
                </p>
                {swatch ? (
                  <div className="mt-3 flex gap-1.5">
                    {[
                      swatch.background,
                      swatch.text,
                      swatch.buttonBg,
                      swatch.buttonText,
                    ].map((hex, index) => (
                      <span
                        key={`${template.filename}-${index}`}
                        className="size-4 rounded-sm border border-border"
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                  </div>
                ) : null}
                {template.look?.slots?.length ? (
                  <p className="mt-2 text-[10px] text-muted-foreground line-clamp-2">
                    PDP order:{" "}
                    {template.look.slots
                      .filter((slot) => slot.kind !== "placeholder")
                      .map((slot) => slot.label)
                      .join(" · ")}
                  </p>
                ) : template.look?.sections?.length ? (
                  <p className="mt-2 text-[10px] text-muted-foreground line-clamp-2">
                    {template.look.sections
                      .map((section) => section.label)
                      .join(" · ")}
                  </p>
                ) : null}
              </a>
            );
          })}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Sync templates first. Needs <code>read_themes</code> scope — update
          app scopes and re-open shop install if sync errors.
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        Prefer boxes?{" "}
        <Link href={simpleHref} className="underline">
          Simple forms
        </Link>
      </p>
    </div>
  );
}

export function VisualProductFlow({
  mode,
  shopName,
  shopScope,
  selectedSuffix,
  pickHref,
  fillBaseHref,
  simpleHref,
  syncReturnTo,
  themeTemplates,
  action,
  productTypes,
  locations,
  definitions,
  values,
  productId,
  variantId,
  flash,
}: VisualProductFlowProps) {
  if (selectedSuffix === null) {
    return (
      <TemplatePicker
        fillBaseHref={fillBaseHref}
        simpleHref={simpleHref}
        shopName={shopName}
        themeTemplates={themeTemplates}
        syncReturnTo={syncReturnTo}
        flash={flash}
      />
    );
  }

  const activeLocations = locations.filter((location) => location.isActive);
  const defaultLocationId =
    values.locationId || activeLocations[0]?.id || "";
  const selectedLabel =
    themeTemplates?.templates.find(
      (template) => (template.suffix ?? "") === selectedSuffix,
    )?.label ?? (selectedSuffix ? selectedSuffix : "Default product page");
  const canvasLook = findSyncedTemplateLook(themeTemplates, selectedSuffix);
  const themeFieldCount =
    canvasLook?.slots?.filter((slot) => slot.kind === "metafield").length ?? 0;
  const definitionCount = definitions.length;
  void shopScope;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {mode === "create" ? "New product" : "Edit product"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Template: <strong>{selectedLabel}</strong> — canvas uses last synced
            theme look. Sync again only if theme colors/sections changed.
            {themeFieldCount > 0 ? (
              <>
                {" "}
                <span className="text-foreground">
                  ({themeFieldCount} theme field{themeFieldCount === 1 ? "" : "s"})
                </span>
              </>
            ) : null}
          </p>
          {themeFieldCount === 0 ? (
            <p className="mt-1 text-xs text-amber-700">
              No PDP metafields in cached template — click Sync templates.
              {definitionCount === 0
                ? " Also sync metafield definitions for this shop (Simple forms tab)."
                : null}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={pickHref} className="mf-btn text-xs">
            Change template
          </a>
          <form action={syncThemeTemplatesAction}>
            <input type="hidden" name="returnTo" value={syncReturnTo} />
            <button type="submit" className="mf-btn text-xs">
              Sync templates
            </button>
          </form>
          <Link href={simpleHref} className="mf-btn text-xs">
            Simple forms
          </Link>
        </div>
      </div>

      {flash?.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {flash.error}
        </p>
      ) : null}
      {flash?.saved || flash?.created ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          Saved
          {flash.created && flash.created !== "1" ? `: ${flash.created}` : ""}.
        </p>
      ) : null}

      <form action={action} data-visual-product-form="" className="space-y-6">
        <input type="hidden" name="view" value="visual" />
        <input type="hidden" name="templateSuffix" value={selectedSuffix} />
        {productId ? (
          <input type="hidden" name="productId" value={productId} />
        ) : null}
        {variantId ? (
          <input type="hidden" name="variantId" value={variantId} />
        ) : null}

        <HeritagePdpCanvas
          values={{
            title: values.title,
            price: values.price,
            descriptionHtml: values.descriptionHtml,
            metafieldValues: values.metafieldValues,
          }}
          definitions={definitions}
          look={canvasLook}
        />
        <input type="hidden" name="vendor" value={values.vendor} />
        <input type="hidden" name="compareAtPrice" value={values.compareAtPrice} />

        <section className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
          <div>
            <h2 className="text-base font-semibold">Stock &amp; publishing</h2>
            <p className="text-xs text-muted-foreground">
              Not on the product page look — set here before save.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Status</span>
              <select
                name="status"
                className={inputClassName}
                defaultValue={values.status}
              >
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
                defaultChecked={values.publish}
                className="size-4"
              />
              <span>Publish to sales channels</span>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">SKU</span>
              <input
                name="sku"
                className={inputClassName}
                defaultValue={values.sku}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Handle</span>
              <input
                name="handle"
                className={inputClassName}
                defaultValue={values.handle}
                placeholder="auto from title if empty"
              />
            </label>

            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                name="trackInventory"
                value="true"
                defaultChecked={values.trackInventory}
                className="size-4"
              />
              <span>Track quantity</span>
            </label>

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
                defaultValue={
                  values.inventoryQuantity === null
                    ? 0
                    : values.inventoryQuantity
                }
              />
            </label>

            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-muted-foreground">When sold out</span>
              <select
                name="inventoryPolicy"
                className={inputClassName}
                defaultValue={values.inventoryPolicy}
              >
                <option value="DENY">Stop selling</option>
                <option value="CONTINUE">Continue selling</option>
              </select>
            </label>

            {productTypes.length > 0 ? (
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-muted-foreground">Product type</span>
                <select
                  name="productType"
                  className={inputClassName}
                  defaultValue={values.productType}
                >
                  <option value="">—</option>
                  {productTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {mode === "create" ? (
              <div className="sm:col-span-2">
                <ProductImagesField />
              </div>
            ) : null}
          </div>
        </section>

        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          {mode === "create" ? "Create product" : "Save product"}
        </button>
      </form>
      <script src="/visual-pdp.js" defer />
    </div>
  );
}
