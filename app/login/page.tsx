import Link from "next/link";
import { MerchantLoginForm } from "@/components/merchant/MerchantLoginForm";
import { countMerchantUsersForShop } from "@/lib/db/merchant-users";
import { getShopWithConfig } from "@/lib/db/shops";
import { verifyMerchantPortalHandoffToken } from "@/lib/merchant/auth";
import { resolveShopifyShopEmail } from "@/lib/merchant/shop-email";

interface MerchantLoginPageProps {
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

export default async function MerchantLoginPage({
  searchParams,
}: MerchantLoginPageProps) {
  const query = await searchParams;
  const returnTo = firstParam(query.return_to) ?? "/merchant/products";
  const handoff = firstParam(query.handoff);
  const shopIdParam = firstParam(query.shopId);
  const errorCode = firstParam(query.error);

  const errorMessage =
    errorCode === "handoff_expired"
      ? "Store link expired. Open the app from Shopify Admin Home and click Manage again."
      : errorCode === "sign_in_required"
        ? "Sign in to open the merchant dashboard."
        : undefined;

  let shopId = shopIdParam;
  let shopName: string | undefined;
  let shopDomain: string | undefined;
  let defaultEmail: string | undefined;
  let hasUsers = false;

  if (handoff) {
    const payload = verifyMerchantPortalHandoffToken(handoff);
    if (payload) {
      shopId = payload.shopId;
      const shop = await getShopWithConfig(payload.shopId);
      if (shop?.isActive) {
        shopName = shop.shopName;
        shopDomain = shop.shopDomain;
        defaultEmail = await resolveShopifyShopEmail(shop);
        hasUsers = (await countMerchantUsersForShop(shop.id)) > 0;
      }
    }
  } else if (shopIdParam) {
    const shop = await getShopWithConfig(shopIdParam);
    if (shop?.isActive) {
      shopId = shop.id;
      shopName = shop.shopName;
      shopDomain = shop.shopDomain;
      defaultEmail = await resolveShopifyShopEmail(shop);
      hasUsers = (await countMerchantUsersForShop(shop.id)) > 0;
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-xl border border-border bg-card p-8">
        <h1 className="text-2xl font-semibold">Merchant login</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to your store dashboard on this app domain. Separate from
          agency operator login.
        </p>
        {errorMessage ? (
          <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
        <div className="mt-6">
          <MerchantLoginForm
            returnTo={
              returnTo.startsWith("/merchant")
                ? returnTo
                : "/merchant/products"
            }
            shopId={shopId}
            handoff={handoff}
            shopName={shopName}
            shopDomain={shopDomain}
            defaultEmail={defaultEmail}
            hasUsers={hasUsers}
          />
        </div>
        <div className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">
          Agency owner or operator?{" "}
          <Link href="/agency/login" className="font-medium text-primary hover:underline">
            Go to Agency Login &rarr;
          </Link>
        </div>
      </div>
    </main>
  );
}
