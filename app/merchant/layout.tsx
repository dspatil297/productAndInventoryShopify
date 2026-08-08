import { redirect } from "next/navigation";
import { MerchantDashboardNav } from "@/components/merchant/MerchantDashboardNav";
import { listMerchantStoresForEmail } from "@/lib/db/merchant-users";
import {
  getMerchantPortalShop,
  getMerchantPortalUser,
} from "@/lib/merchant/auth";

export const dynamic = "force-dynamic";

export default async function MerchantPortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shop = await getMerchantPortalShop();
  if (!shop) {
    redirect("/login");
  }

  const user = await getMerchantPortalUser();
  let showSwitchStore = false;
  if (user) {
    const siblings = await listMerchantStoresForEmail(user.email);
    showSwitchStore =
      siblings.filter((row) => row.shop.isActive).length > 1;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <MerchantDashboardNav
        shopName={shop.shopName}
        showSwitchStore={showSwitchStore}
      />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
