import { MetafieldSpreadsheet } from "@/components/merchant/MetafieldSpreadsheet";
import { getShopWithConfig } from "@/lib/db/shops";
import { listShopMetafields } from "@/lib/metafields/list-metafields";
import {
  buildMetafieldListHref,
  parseMetafieldListUrlState,
} from "@/lib/metafields/search-params";
import { requireMerchantPortalShop } from "@/lib/merchant/auth";

interface MerchantMetafieldsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readFlash(
  query: Record<string, string | string[] | undefined>,
): { saved?: string; refreshed?: string; error?: string } {
  const saved = typeof query.saved === "string" ? query.saved : undefined;
  const refreshed =
    typeof query.refreshed === "string" ? query.refreshed : undefined;
  const error = typeof query.error === "string" ? query.error : undefined;
  return { saved, refreshed, error };
}

export default async function MerchantMetafieldsPage({
  searchParams,
}: MerchantMetafieldsPageProps) {
  const query = await searchParams;
  const shop = await requireMerchantPortalShop();
  const shopWithConfig = await getShopWithConfig(shop.id);
  if (!shopWithConfig) {
    throw new Error("Store not found");
  }

  const listState = parseMetafieldListUrlState(query);
  const data = await listShopMetafields(shopWithConfig, {
    first: listState.first,
    after: listState.after,
    search: listState.search || null,
  });

  const returnTo = buildMetafieldListHref("/merchant/metafields", {
    first: listState.first,
    search: listState.search,
    history: listState.history,
  });

  return (
    <MetafieldSpreadsheet
      shopId={shop.id}
      shopName={shop.shopName}
      data={data}
      listState={listState}
      basePath="/merchant/metafields"
      returnTo={returnTo}
      flash={readFlash(query)}
    />
  );
}
