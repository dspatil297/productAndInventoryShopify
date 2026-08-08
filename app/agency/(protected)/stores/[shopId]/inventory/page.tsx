import Link from "next/link";
import { notFound } from "next/navigation";
import { InventoryGrid } from "@/components/merchant/InventoryGrid";
import { getShopWithConfig } from "@/lib/db/shops";
import { listShopInventory } from "@/lib/inventory/list-inventory";
import { readLocationsFromConfig } from "@/lib/inventory/locations";
import {
  buildInventoryListHref,
  parseInventoryListUrlState,
} from "@/lib/inventory/search-params";
import { readProductTypesFromConfig } from "@/lib/products/config";

interface AgencyInventoryPageProps {
  params: Promise<{ shopId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readFlash(
  query: Record<string, string | string[] | undefined>,
): { saved?: string; error?: string } {
  const saved = typeof query.saved === "string" ? query.saved : undefined;
  const error = typeof query.error === "string" ? query.error : undefined;
  return { saved, error };
}

export default async function AgencyInventoryPage({
  params,
  searchParams,
}: AgencyInventoryPageProps) {
  const { shopId } = await params;
  const query = await searchParams;
  const shop = await getShopWithConfig(shopId);
  if (!shop) {
    notFound();
  }

  const listState = parseInventoryListUrlState(query);
  const locations = readLocationsFromConfig(shop.config);
  const productTypes = readProductTypesFromConfig(shop.config);
  const data = await listShopInventory(shop, {
    first: listState.first,
    after: listState.after,
    search: listState.search || null,
    locationId: listState.locationId || null,
    productType: listState.productType || null,
    tracked: listState.tracked,
    stock: listState.stock,
  });

  const basePath = `/agency/stores/${shopId}/inventory`;
  const returnTo = buildInventoryListHref(basePath, {
    first: listState.first,
    search: listState.search,
    locationId: data.locationId || listState.locationId,
    productType: listState.productType,
    tracked: listState.tracked,
    stock: listState.stock,
    history: listState.history,
  });

  return (
    <div className="space-y-6">
      <Link href={`/agency/stores/${shopId}`} className="text-sm underline">
        ← Back to store
      </Link>
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
        basePath={basePath}
        returnTo={returnTo}
        flash={readFlash(query)}
      />
    </div>
  );
}
