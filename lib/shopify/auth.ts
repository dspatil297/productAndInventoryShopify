import {
  CookieNotFound,
  InvalidSession,
} from "@shopify/shopify-api";
import { NextResponse } from "next/server";
import { appRedirectUrl } from "@/lib/agency/app-url";
import { assertOAuthHostConfigured, getOAuthCallbackUrl } from "@/lib/env";
import { bootstrapShop } from "@/lib/shopify/bootstrap";
import { getShopify } from "@/lib/shopify/shopify";

export function sanitizeShopParam(
  shop: string | null,
  request?: Request,
): string | null {
  if (!shop) {
    return null;
  }
  return getShopify(request).utils.sanitizeShop(shop, true);
}

export async function beginShopifyAuth(
  shop: string,
  request: Request,
): Promise<Response> {
  assertOAuthHostConfigured(request);
  if (process.env.NODE_ENV === "development") {
    console.info("[oauth] begin", {
      shop,
      callbackUrl: getOAuthCallbackUrl(request),
    });
  }
  return getShopify(request).auth.begin({
    shop,
    callbackPath: "/api/auth/callback",
    isOnline: false,
    rawRequest: request,
    rawResponse: new NextResponse(),
  });
}

function isMissingOAuthCookieError(error: unknown): boolean {
  if (error instanceof CookieNotFound || error instanceof InvalidSession) {
    return true;
  }
  if (error instanceof Error) {
    return (
      error.message.includes("bot") ||
      error.message.includes("cookie") ||
      error.message.includes("OAuth cookie")
    );
  }
  return false;
}

export async function completeShopifyAuth(
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  const oauthDescription = url.searchParams.get("error_description");
  if (oauthError) {
    const message = oauthDescription ?? oauthError;
    return NextResponse.redirect(
      appRedirectUrl(request, `/agency/connect?error=${encodeURIComponent(message)}`),
    );
  }

  const shop = sanitizeShopParam(url.searchParams.get("shop"), request);
  const host = url.searchParams.get("host");
  const shopify = getShopify(request);

  if (!shop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  try {
    const callback = await shopify.auth.callback({
      rawRequest: request,
    });

    const { session } = callback;
    if (!session.accessToken) {
      throw new Error("OAuth callback did not return an access token");
    }

    await bootstrapShop(session.shop, session.accessToken, session.scope);

    if (shopify.config.isEmbeddedApp && host) {
      const embeddedUrl = await shopify.auth.getEmbeddedAppUrl({
        rawRequest: request,
        rawResponse: new NextResponse(),
      });
      return NextResponse.redirect(embeddedUrl);
    }

    return NextResponse.redirect(appRedirectUrl(request, "/app"));
  } catch (error) {
    if (isMissingOAuthCookieError(error)) {
      return beginShopifyAuth(shop, request);
    }
    throw error;
  }
}
