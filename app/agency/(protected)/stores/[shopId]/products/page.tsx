import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductTable } from "@/components/merchant/ProductTable";
import { readProductTypesFromConfig } from "@/lib/products/config";
import { listShopProducts } from "@/lib/products/list-products";
import {
  buildProductListHref,
  parseProductListUrlState,
} from "@/lib/products/search-params";
import { getShopWithConfig } from "@/lib/db/shops";

interface AgencyProductsPageProps {
  params: Promise<{ shopId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AgencyProductsPage({
  params,
  searchParams,
}: AgencyProductsPageProps) {
  const { shopId } = await params;
  const query = await searchParams;
  const shop = await getShopWithConfig(shopId);
  if (!shop) {
    notFound();
  }

  const productTypes = readProductTypesFromConfig(shop.config);
  const listState = parseProductListUrlState(query);
  const data = await listShopProducts(shop, {
    first: listState.first,
    after: listState.after,
    search: listState.search || null,
    productType: listState.productType || null,
  });

  const error = typeof query.error === "string" ? query.error : undefined;
  const deleted = typeof query.deleted === "string" ? query.deleted : undefined;
  const basePath = `/agency/stores/${shopId}/products`;
  const returnTo = buildProductListHref(basePath, {
    first: listState.first,
    search: listState.search,
    productType: listState.productType,
    history: listState.history,
  });

  return (
    <div className="space-y-6">
      <Link href={`/agency/stores/${shopId}`} className="text-sm underline">
        ← Back to store
      </Link>
      <ProductTable
        shopId={shop.id}
        shopName={shop.shopName}
        productTypes={productTypes}
        data={data}
        listState={listState}
        basePath={basePath}
        returnTo={returnTo}
        flash={{ error, deleted }}
      />
    </div>
  );
}
