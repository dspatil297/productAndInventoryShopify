import { NextResponse } from "next/server";
import { appRedirectUrl } from "@/lib/agency/app-url";
import {
  AgencyAuthError,
  requireAgencySessionUserFromRequest,
} from "@/lib/agency/auth";
import { disconnectShop, getShopWithConfig } from "@/lib/db/shops";

interface RouteContext {
  params: Promise<{ shopId: string }>;
}

function wantsHtmlRedirect(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return (
    accept.includes("text/html") ||
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  );
}

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireAgencySessionUserFromRequest(request);
  } catch (error) {
    if (error instanceof AgencyAuthError) {
      if (wantsHtmlRedirect(request)) {
        return NextResponse.redirect(appRedirectUrl(request, "/agency/login"));
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }

  const { shopId } = await context.params;
  const shop = await getShopWithConfig(shopId);
  if (!shop) {
    if (wantsHtmlRedirect(request)) {
      return NextResponse.redirect(
        appRedirectUrl(request, "/agency/stores?error=not_found"),
      );
    }
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  await disconnectShop(shopId, { purgeToken: false });

  if (wantsHtmlRedirect(request)) {
    return NextResponse.redirect(appRedirectUrl(request, "/agency/stores?disconnected=1"));
  }

  return NextResponse.json({ ok: true });
}
