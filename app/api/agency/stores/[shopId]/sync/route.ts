import { NextResponse } from "next/server";
import { appRedirectUrl } from "@/lib/agency/app-url";
import {
  AgencyAuthError,
  requireAgencySessionUserFromRequest,
} from "@/lib/agency/auth";
import { toAgencyStoreSummary } from "@/lib/agency/stores";
import { getShopAccessToken, getShopWithConfig } from "@/lib/db/shops";
import { bootstrapShop } from "@/lib/shopify/bootstrap";

interface RouteContext {
  params: Promise<{ shopId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireAgencySessionUserFromRequest(request);
  } catch (error) {
    if (error instanceof AgencyAuthError) {
      const accept = request.headers.get("accept") ?? "";
      if (accept.includes("text/html")) {
        return NextResponse.redirect(appRedirectUrl(request, "/agency/login"));
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }

  const { shopId } = await context.params;
  const shop = await getShopWithConfig(shopId);
  if (!shop) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  if (!shop.isActive) {
    return NextResponse.json({ error: "Store is inactive" }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = getShopAccessToken(shop);
  } catch {
    return NextResponse.json(
      { error: "Store access token unavailable" },
      { status: 400 },
    );
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: "Store access token unavailable" },
      { status: 400 },
    );
  }

  await bootstrapShop(shop.shopDomain, accessToken, shop.scope ?? undefined);
  const refreshed = await getShopWithConfig(shopId);
  if (!refreshed) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  const wantsHtmlRedirect =
    accept.includes("text/html") ||
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data");

  if (wantsHtmlRedirect) {
    return NextResponse.redirect(appRedirectUrl(request, "/agency/stores?synced=1"));
  }

  return NextResponse.json({ store: toAgencyStoreSummary(refreshed) });
}
