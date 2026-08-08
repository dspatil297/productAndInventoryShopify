import { InventoryGrid } from "@/components/merchant/InventoryGrid";
import { getShopWithConfig } from "@/lib/db/shops";
import { listShopInventory } from "@/lib/inventory/list-inventory";
import { readLocationsFromConfig } from "@/lib/inventory/locations";
import {
  buildInventoryListHref,
  parseInventoryListUrlState,
} from "@/lib/inventory/search-params";
import { requireMerchantPortalShop } from "@/lib/merchant/auth";
import { readProductTypesFromConfig } from "@/lib/products/config";

interface MerchantInventoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readFlash(
  query: Record<string, string | string[] | undefined>,
): { saved?: string; error?: string } {
  const saved = typeof query.saved === "string" ? query.saved : undefined;
  const error = typeof query.error === "string" ? query.error : undefined;
  return { saved, error };
}

export default async function MerchantInventoryPage({
  searchParams,
}: MerchantInventoryPageProps) {
  const query = await searchParams;
  const shop = await requireMerchantPortalShop();
  const shopWithConfig = await getShopWithConfig(shop.id);
  if (!shopWithConfig) {
    throw new Error("Store not found");
  }

  const listState = parseInventoryListUrlState(query);
  const locations = readLocationsFromConfig(shopWithConfig.config);
  const productTypes = readProductTypesFromConfig(shopWithConfig.config);
  const data = await listShopInventory(shopWithConfig, {
    first: listState.first,
    after: listState.after,
    search: listState.search || null,
    locationId: listState.locationId || null,
    productType: listState.productType || null,
    tracked: listState.tracked,
    stock: listState.stock,
  });

  const returnTo = buildInventoryListHref("/merchant/inventory", {
    first: listState.first,
    search: listState.search,
    locationId: data.locationId || listState.locationId,
    productType: listState.productType,
    tracked: listState.tracked,
    stock: listState.stock,
    history: listState.history,
  });

  return (
    <InventoryGrid
      shopId={shop.id}
      shopName={shop.shopName}
      locations={locations}
      productTypes={productTypes}
      data={data}
      listState={{
        ...listState,
        locationId: data.locationId || listState.locationId,
      }}
      basePath="/merchant/inventory"
      returnTo={returnTo}
      flash={readFlash(query)}
    />
  );
}
