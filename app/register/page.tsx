import Link from "next/link";
import { MerchantRegisterForm } from "@/components/merchant/MerchantRegisterForm";
import { getShopWithConfig } from "@/lib/db/shops";
import { verifyMerchantPortalHandoffToken } from "@/lib/merchant/auth";
import { resolveShopifyShopEmail } from "@/lib/merchant/shop-email";

interface MerchantRegisterPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function MerchantRegisterPage({
  searchParams,
}: MerchantRegisterPageProps) {
  const query = await searchParams;
  const returnTo = firstParam(query.return_to) ?? "/merchant/products";
  const handoff = firstParam(query.handoff);
  const safeReturnTo = returnTo.startsWith("/merchant")
    ? returnTo
    : "/merchant/products";

  const payload = handoff ? verifyMerchantPortalHandoffToken(handoff) : null;
  const shop = payload ? await getShopWithConfig(payload.shopId) : null;

  if (!handoff || !payload || !shop?.isActive) {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
        <div className="rounded-xl border border-border bg-card p-8">
          <h1 className="text-2xl font-semibold">Create dashboard login</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Open the app from Shopify Admin Home and click{" "}
            <strong>Manage products &amp; inventory</strong> first. That proves
            which store this account belongs to.
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

  const shopEmail = (await resolveShopifyShopEmail(shop)) ?? "";

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-xl border border-border bg-card p-8">
        <h1 className="text-2xl font-semibold">Create dashboard login</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Email is loaded from Shopify for this store. Same email + password
          can link more stores later.
        </p>
        <div className="mt-6">
          <MerchantRegisterForm
            returnTo={safeReturnTo}
            handoff={handoff}
            shopId={shop.id}
            shopName={shop.shopName}
            shopDomain={shop.shopDomain}
            defaultEmail={shopEmail}
          />
        </div>
      </div>
    </main>
  );
}
