import { NextResponse } from "next/server";
import { appRedirectUrl } from "@/lib/agency/app-url";
import {
  beginShopifyAuth,
  sanitizeShopParam,
} from "@/lib/shopify/auth";
import { normalizeShopDomain } from "@/lib/shopify/shop-domain";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawShop = url.searchParams.get("shop");
  const normalizedShop = rawShop ? normalizeShopDomain(rawShop) : null;
  const shop = sanitizeShopParam(normalizedShop, request);

  if (!shop) {
    return NextResponse.json(
      {
        error:
          "Invalid or missing shop. Use ?shop=store-name.myshopify.com (or store-name only).",
      },
      { status: 400 },
    );
  }

  try {
    return await beginShopifyAuth(shop, request);
  } catch (error) {
    console.error("OAuth begin failed", { shop, error });
    const message =
      error instanceof Error ? error.message : "Failed to start OAuth";
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("text/html")) {
      return NextResponse.redirect(
        appRedirectUrl(request, `/agency/connect?error=${encodeURIComponent(message)}`),
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
