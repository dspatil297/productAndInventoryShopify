import { MerchantHome } from "@/components/merchant/MerchantHome";
import { toAgencyStoreSummary } from "@/lib/agency/stores";
import { getShopWithConfig } from "@/lib/db/shops";
import { createMerchantPortalHandoffToken } from "@/lib/merchant/auth";
import { requireMerchantShopFromPage } from "@/lib/merchant/page-context";

interface MerchantAppHomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MerchantAppHome({
  searchParams,
}: MerchantAppHomeProps) {
  const query = await searchParams;
  const { shop } = await requireMerchantShopFromPage("/app", query);
  const shopWithConfig = await getShopWithConfig(shop.id);
  const store = toAgencyStoreSummary(
    shopWithConfig ?? { ...shop, config: null },
  );
  const handoffToken = createMerchantPortalHandoffToken(shop.id);

  return <MerchantHome store={store} handoffToken={handoffToken} />;
}
