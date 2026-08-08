import { ProductTable } from "@/components/merchant/ProductTable";
import { getShopWithConfig } from "@/lib/db/shops";
import { requireMerchantPortalShop } from "@/lib/merchant/auth";
import { readProductTypesFromConfig } from "@/lib/products/config";
import { listShopProducts } from "@/lib/products/list-products";
import {
  buildProductListHref,
  parseProductListUrlState,
} from "@/lib/products/search-params";

interface MerchantProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MerchantProductsPage({
  searchParams,
}: MerchantProductsPageProps) {
  const query = await searchParams;
  const shop = await requireMerchantPortalShop();
  const shopWithConfig = await getShopWithConfig(shop.id);
  const productTypes = readProductTypesFromConfig(shopWithConfig?.config);
  const listState = parseProductListUrlState(query);
  const data = await listShopProducts(shopWithConfig ?? shop, {
    first: listState.first,
    after: listState.after,
    search: listState.search || null,
    productType: listState.productType || null,
  });

  const saved = typeof query.saved === "string" ? query.saved : undefined;
  const error = typeof query.error === "string" ? query.error : undefined;
  const created = typeof query.created === "string" ? query.created : undefined;
  const deleted = typeof query.deleted === "string" ? query.deleted : undefined;

  const returnTo = buildProductListHref("/merchant/products", {
    first: listState.first,
    search: listState.search,
    productType: listState.productType,
    history: listState.history,
  });

  return (
    <ProductTable
      shopId={shop.id}
      shopName={shop.shopName}
      productTypes={productTypes}
      data={data}
      listState={listState}
      basePath="/merchant/products"
      returnTo={returnTo}
      flash={{ saved, error, created, deleted }}
    />
  );
}
