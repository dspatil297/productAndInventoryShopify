import { NextResponse } from "next/server";
import { appRedirectUrl } from "@/lib/agency/app-url";
import { getActiveShopByDomain, getShopWithConfig } from "@/lib/db/shops";
import {
  getMerchantPortalSessionFromRequest,
  verifyMerchantPortalHandoffToken,
} from "@/lib/merchant/auth";
import {
  decodeMerchantSessionToken,
  getSessionTokenFromRequest,
  getSessionTokenFromSearchParams,
  shopDomainFromSessionDest,
} from "@/lib/shopify/session";

function loginUrl(
  request: Request,
  params: {
    returnTo: string;
    handoff?: string;
    shopId?: string;
    error?: string;
  },
): URL {
  const url = new URL(appRedirectUrl(request, "/login"));
  url.searchParams.set("return_to", params.returnTo);
  if (params.handoff) {
    url.searchParams.set("handoff", params.handoff);
  }
  if (params.shopId) {
    url.searchParams.set("shopId", params.shopId);
  }
  if (params.error) {
    url.searchParams.set("error", params.error);
  }
  return url;
}

function softLandOrLogin(
  request: Request,
  shopId: string,
  returnTo: string,
  handoff?: string,
): NextResponse {
  const session = getMerchantPortalSessionFromRequest(request);
  if (session?.shopId === shopId) {
    return NextResponse.redirect(appRedirectUrl(request, returnTo));
  }

  return NextResponse.redirect(
    loginUrl(request, { returnTo, handoff, shopId }),
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("return_to") ?? "/merchant/products";

  const handoff = url.searchParams.get("handoff");
  if (handoff) {
    const payload = verifyMerchantPortalHandoffToken(handoff);
    if (payload) {
      const shop = await getShopWithConfig(payload.shopId);
      if (shop?.isActive) {
        return softLandOrLogin(request, shop.id, returnTo, handoff);
      }
    }

    // Invalid/expired handoff — never fall through to /app bounce (breaks outside iframe)
    return NextResponse.redirect(
      loginUrl(request, {
        returnTo,
        error: "handoff_expired",
      }),
    );
  }

  const sessionToken =
    getSessionTokenFromRequest(request) ??
    getSessionTokenFromSearchParams(url.searchParams);

  if (!sessionToken) {
    return NextResponse.redirect(
      loginUrl(request, { returnTo, error: "sign_in_required" }),
    );
  }

  let shopDomain: string;
  try {
    const payload = await decodeMerchantSessionToken(sessionToken, request);
    shopDomain = shopDomainFromSessionDest(payload.dest);
  } catch {
    return NextResponse.redirect(
      loginUrl(request, { returnTo, error: "sign_in_required" }),
    );
  }

  const shop = await getActiveShopByDomain(shopDomain);
  if (!shop) {
    return NextResponse.redirect(
      loginUrl(request, { returnTo, error: "sign_in_required" }),
    );
  }

  return softLandOrLogin(request, shop.id, returnTo);
}
