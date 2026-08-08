import { headers } from "next/headers";
import { resolveShopifyHostName } from "@/lib/env";

export function getAppBaseUrlFromRequest(request: Request): string {
  const hostname = resolveShopifyHostName(request);
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
  return `${proto}://${hostname}`;
}

/** Build redirect URL using public app host (tunnel), not internal localhost from CLI proxy. */
export function appRedirectUrl(request: Request, path: string): URL {
  const base = getAppBaseUrlFromRequest(request);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, `${base}/`);
}

/**
 * Redirect after HTML form POST.
 * Must be 303 (not default 307) so browser follows with GET — otherwise Next
 * treats re-POST to a page as a missing Server Action.
 */
export function appFormRedirect(request: Request, path: string): Response {
  return Response.redirect(appRedirectUrl(request, path), 303);
}

export async function getAppBaseUrlFromHeaders(): Promise<string> {
  const headerList = await headers();
  const headerMap = new Headers();

  for (const name of ["host", "x-forwarded-host", "x-forwarded-proto"]) {
    const value = headerList.get(name);
    if (value) {
      headerMap.set(name, value);
    }
  }

  if (!headerMap.has("host") && !headerMap.has("x-forwarded-host")) {
    headerMap.set("host", "localhost:3000");
  }

  return getAppBaseUrlFromRequest(new Request("https://placeholder", { headers: headerMap }));
}
