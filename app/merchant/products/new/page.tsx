import Link from "next/link";
import { createVisualMerchantProductAction } from "@/app/merchant/products/new/visual-actions";
import { ProductForm } from "@/components/merchant/ProductForm";
import { VisualProductFlow } from "@/components/merchant/VisualProductFlow";
import { getShopWithConfig } from "@/lib/db/shops";
import { readLocationsFromConfig } from "@/lib/inventory/locations";
import { readMetafieldDefinitionsFromConfig } from "@/lib/metafields/config";
import { requireMerchantPortalShop } from "@/lib/merchant/auth";
import { readProductTypesFromConfig } from "@/lib/products/config";
import { readSyncedThemeTemplates } from "@/lib/products/theme-templates";

interface MerchantNewProductPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function MerchantNewProductPage({
  searchParams,
}: MerchantNewProductPageProps) {
  const query = await searchParams;
  const shop = await requireMerchantPortalShop();
  const shopWithConfig = await getShopWithConfig(shop.id);
  const definitions = readMetafieldDefinitionsFromConfig(
    shopWithConfig?.config,
  );
  const productTypes = readProductTypesFromConfig(shopWithConfig?.config);
  const locations = readLocationsFromConfig(shopWithConfig?.config);
  const themeTemplates = readSyncedThemeTemplates(shopWithConfig?.config);
  const viewRaw = firstParam(query.view)?.toLowerCase();
  const view = viewRaw === "visual" ? "visual" : "simple";
  /** null = picker; string (maybe "") = selected theme template suffix */
  const suffixParam = firstParam(query.suffix);
  const selectedSuffix =
    view === "visual" && suffixParam !== undefined ? suffixParam : null;

  const flash = {
    error: firstParam(query.error),
    saved: firstParam(query.saved),
    created: firstParam(query.created),
    synced: firstParam(query.synced),
    templates: firstParam(query.templates),
  };

  const tabBase = "rounded px-3 py-1.5 text-sm no-underline";
  const tabOn = `${tabBase} bg-primary text-primary-foreground`;
  const tabOff = `${tabBase} text-muted-foreground hover:text-foreground`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border p-0.5">
          <Link
            href="/merchant/products/new"
            className={view === "simple" ? tabOn : tabOff}
          >
            Simple forms
          </Link>
          <Link
            href="/merchant/products/new?view=visual"
            className={view === "visual" ? tabOn : tabOff}
          >
            Visual templates
          </Link>
        </div>
      </div>

      {view === "visual" ? (
        <VisualProductFlow
          mode="create"
          shopName={shop.shopName}
          shopScope={shop.scope}
          selectedSuffix={selectedSuffix}
          pickHref="/merchant/products/new?view=visual"
          fillBaseHref="/merchant/products/new?view=visual"
          simpleHref="/merchant/products/new"
          syncReturnTo="/merchant/products/new?view=visual"
          themeTemplates={themeTemplates}
          action={createVisualMerchantProductAction}
          productTypes={productTypes}
          locations={locations}
          definitions={definitions}
          values={{
            title: "",
            handle: "",
            descriptionHtml: "",
            productType: "",
            vendor: "",
            price: "",
            compareAtPrice: "",
            sku: "",
            status: "ACTIVE",
            inventoryPolicy: "DENY",
            trackInventory: true,
            inventoryQuantity: 0,
            locationId:
              locations.find((location) => location.isActive)?.id ?? "",
            publish: true,
            metafieldValues: {},
          }}
          flash={flash}
        />
      ) : (
        <ProductForm
          shopId={shop.id}
          shopName={shop.shopName}
          productTypes={productTypes}
          locations={locations}
          definitions={definitions}
          returnTo="/merchant/products/new"
          flash={flash}
        />
      )}
    </div>
  );
}
