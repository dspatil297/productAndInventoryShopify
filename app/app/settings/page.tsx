import { MerchantModuleShell } from "@/components/merchant/MerchantModuleShell";
import { requireMerchantShopFromPage } from "@/lib/merchant/page-context";

interface SettingsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const query = await searchParams;
  const { shop } = await requireMerchantShopFromPage("/app/settings", query);

  return (
    <MerchantModuleShell
      title="Settings"
      shopName={shop.shopName}
      description="Store preferences ship in a later phase."
    />
  );
}
