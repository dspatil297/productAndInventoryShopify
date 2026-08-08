import Link from "next/link";
import { notFound } from "next/navigation";
import { MetafieldSpreadsheet } from "@/components/merchant/MetafieldSpreadsheet";
import { listShopMetafields } from "@/lib/metafields/list-metafields";
import {
  buildMetafieldListHref,
  parseMetafieldListUrlState,
} from "@/lib/metafields/search-params";
import { getShopWithConfig } from "@/lib/db/shops";

interface AgencyMetafieldsPageProps {
  params: Promise<{ shopId: string }>;
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

export default async function AgencyMetafieldsPage({
  params,
  searchParams,
}: AgencyMetafieldsPageProps) {
  const { shopId } = await params;
  const query = await searchParams;
  const shop = await getShopWithConfig(shopId);
  if (!shop) {
    notFound();
  }

  const listState = parseMetafieldListUrlState(query);
  const data = await listShopMetafields(shop, {
    first: listState.first,
    after: listState.after,
    search: listState.search || null,
  });

  const basePath = `/agency/stores/${shopId}/metafields`;
  const returnTo = buildMetafieldListHref(basePath, {
    first: listState.first,
    search: listState.search,
    history: listState.history,
  });

  return (
    <div className="space-y-6">
      <Link href={`/agency/stores/${shopId}`} className="text-sm underline">
        ← Back to store
      </Link>
      <MetafieldSpreadsheet
        shopId={shop.id}
        shopName={shop.shopName}
        data={data}
        listState={listState}
        basePath={basePath}
        returnTo={returnTo}
        flash={readFlash(query)}
      />
    </div>
  );
}
