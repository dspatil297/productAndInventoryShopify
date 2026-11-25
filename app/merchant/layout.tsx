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
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <MerchantDashboardNav
        shopName={shop.shopName}
        showSwitchStore={showSwitchStore}
      />
      <main className="flex-1 overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto w-full max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}
