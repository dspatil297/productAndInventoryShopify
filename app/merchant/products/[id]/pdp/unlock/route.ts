import { NextResponse } from "next/server";
import { getAppBaseUrlFromRequest } from "@/lib/agency/app-url";
import {
  MerchantPortalAuthError,
  requireMerchantPortalShopFromRequest,
} from "@/lib/merchant/auth";
import { productGidFromParam, productNumericId } from "@/lib/products/product-gid";
import { unlockStorefrontPassword } from "@/lib/products/pdp-proxy";
import { setStorefrontUnlockCookie } from "@/lib/products/storefront-unlock-cookie";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  let shop;
  try {
    shop = await requireMerchantPortalShopFromRequest(request);
  } catch (error) {
    if (error instanceof MerchantPortalAuthError) {
      return NextResponse.redirect(new URL("/login", request.url), 303);
    }
    throw error;
  }

  const { id } = await context.params;
  const productGid = productGidFromParam(id);
  if (!productGid) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const form = await request.formData();
  const password = String(form.get("password") ?? "").trim();
  const appOrigin = getAppBaseUrlFromRequest(request);
  const numericId = productNumericId(productGid);
  const pdpUrl = new URL(
    `/merchant/products/${numericId}/pdp`,
    `${appOrigin}/`,
  );

  if (!password) {
    pdpUrl.searchParams.set("unlock_error", "Password required");
    return NextResponse.redirect(pdpUrl, 303);
  }

  try {
    const cookieHeader = await unlockStorefrontPassword(
      shop.shopDomain,
      password,
    );
    await setStorefrontUnlockCookie(shop.id, cookieHeader);
    pdpUrl.searchParams.set("bust", String(Date.now()));
    return NextResponse.redirect(pdpUrl, 303);
  } catch (error) {
    pdpUrl.searchParams.set(
      "unlock_error",
      error instanceof Error ? error.message : "Unlock failed",
    );
    return NextResponse.redirect(pdpUrl, 303);
  }
}
