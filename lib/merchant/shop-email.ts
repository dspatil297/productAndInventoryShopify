import type { Shop } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import { SHOP_QUERY } from "@/lib/shopify/queries";

/**
 * Live shop contact email from Shopify Admin, fallback DB `shopEmail`.
 * Best-effort refresh of DB when Shopify returns a value.
 */
export async function resolveShopifyShopEmail(
  shop: Shop,
): Promise<string | undefined> {
  try {
    const data = await shopifyGraphqlForShop<{
      shop: { email: string | null };
    }>(shop, SHOP_QUERY);

    const liveEmail = data.shop.email?.trim().toLowerCase() || null;
    if (liveEmail) {
      if (shop.shopEmail !== liveEmail) {
        await prisma.shop.update({
          where: { id: shop.id },
          data: { shopEmail: liveEmail },
        });
      }
      return liveEmail;
    }
  } catch (error) {
    console.error("[merchant/auth] shop email fetch failed", {
      shopId: shop.id,
      error,
    });
  }

  return shop.shopEmail?.trim().toLowerCase() || undefined;
}
