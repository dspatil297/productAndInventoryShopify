import { NextResponse } from "next/server";
import { appRedirectUrl } from "@/lib/agency/app-url";
import { clearMerchantPortalSessionCookie } from "@/lib/merchant/cookies";

function wantsHtmlRedirect(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return (
    accept.includes("text/html") ||
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  );
}

export async function POST(request: Request) {
  await clearMerchantPortalSessionCookie();

  if (wantsHtmlRedirect(request)) {
    return NextResponse.redirect(appRedirectUrl(request, "/login"));
  }

  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  await clearMerchantPortalSessionCookie();
  return NextResponse.redirect(appRedirectUrl(request, "/login"));
}
