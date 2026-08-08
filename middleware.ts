import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MERCHANT_PORTAL_SESSION_COOKIE = "merchant_portal_session";

const PUBLIC_MERCHANT_PREFIXES = ["/merchant/enter"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/merchant")) {
    return NextResponse.next();
  }

  if (PUBLIC_MERCHANT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (!request.cookies.get(MERCHANT_PORTAL_SESSION_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("return_to", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/merchant/:path*"],
};
