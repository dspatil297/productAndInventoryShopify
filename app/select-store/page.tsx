import Link from "next/link";
import { MerchantSelectStoreForm } from "@/components/merchant/MerchantSelectStoreForm";
import { getMerchantUsersByIdsWithShop } from "@/lib/db/merchant-users";
import { getMerchantStorePickPayload } from "@/lib/merchant/store-pick";

export default async function MerchantSelectStorePage() {
  const pick = await getMerchantStorePickPayload();
  if (!pick) {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
        <div className="rounded-xl border border-border bg-card p-8">
          <h1 className="text-2xl font-semibold">Select store</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in first — then pick which store to open.
          </p>
          <p className="mt-6 text-sm">
            <Link className="underline" href="/login">
              Back to sign in
            </Link>
          </p>
        </div>
      </main>
    );
  }

  const memberships = await getMerchantUsersByIdsWithShop(pick.userIds);
  const stores = memberships
    .filter((row) => row.shop.isActive)
    .map((row) => ({
      userId: row.id,
      shopName: row.shop.shopName,
      shopDomain: row.shop.shopDomain,
    }));

  if (stores.length === 0) {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
        <div className="rounded-xl border border-border bg-card p-8">
          <h1 className="text-2xl font-semibold">Select store</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No active stores available. Sign in again or open from Shopify Admin.
          </p>
          <p className="mt-6 text-sm">
            <Link className="underline" href="/login">
              Back to sign in
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-xl border border-border bg-card p-8">
        <h1 className="text-2xl font-semibold">Select store</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This login is linked to more than one store. Pick which one to open.
        </p>
        <div className="mt-6">
          <MerchantSelectStoreForm stores={stores} />
        </div>
      </div>
    </main>
  );
}
