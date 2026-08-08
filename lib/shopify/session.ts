import type { Shop } from "@/generated/prisma/client";
import { getActiveShopByDomain } from "@/lib/db/shops";
import { getShopify } from "@/lib/shopify/shopify";

export class MerchantSessionError extends Error {
  readonly code: "missing_token" | "invalid_token" | "shop_not_found" | "shop_inactive";

  constructor(
    message: string,
    code: "missing_token" | "invalid_token" | "shop_not_found" | "shop_inactive",
  ) {
    super(message);
    this.name = "MerchantSessionError";
    this.code = code;
  }
}

export interface MerchantSession {
  shop: Shop;
  shopDomain: string;
  sessionToken: string;
}

type SearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

export function getSessionTokenFromRequest(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim();
  }
  return null;
}

export function getSessionTokenFromSearchParams(
  searchParams: SearchParamsInput,
): string | null {
  if (searchParams instanceof URLSearchParams) {
    return searchParams.get("id_token");
  }

  const raw = searchParams.id_token;
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw[0] ?? null;
  }
  return null;
}

export function isDocumentRequest(request: Request): boolean {
  return !getSessionTokenFromRequest(request);
}

export function shopDomainFromSessionDest(dest: string): string {
  return new URL(dest).hostname;
}

export async function decodeMerchantSessionToken(
  token: string,
  request?: Request,
): Promise<{ dest: string; iss: string; sub: string; exp: number }> {
  const shopify = getShopify(request);
  return shopify.session.decodeSessionToken(token);
}

export function getHostParam(searchParams: SearchParamsInput): string | null {
  if (searchParams instanceof URLSearchParams) {
    return searchParams.get("host");
  }
  const raw = searchParams.host;
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw[0] ?? null;
  }
  return null;
}

export function getShopParam(searchParams: SearchParamsInput): string | null {
  if (searchParams instanceof URLSearchParams) {
    return searchParams.get("shop");
  }
  const raw = searchParams.shop;
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw[0] ?? null;
  }
  return null;
}

function resolveShopFromEmbeddedParams(
  searchParams: SearchParamsInput,
  request?: Request,
): string | null {
  const shop = getShopParam(searchParams);
  const host = getHostParam(searchParams);
  if (!shop || !host) {
    return null;
  }
  return getShopify(request).utils.sanitizeShop(shop, true);
}

async function loadActiveShop(shopDomain: string): Promise<Shop> {
  const shop = await getActiveShopByDomain(shopDomain);
  if (!shop) {
    throw new MerchantSessionError(
      `No active shop record for ${shopDomain}`,
      "shop_not_found",
    );
  }
  return shop;
}

export async function resolveMerchantShop(
  request: Request,
  searchParams?: SearchParamsInput,
): Promise<MerchantSession> {
  const sessionToken =
    getSessionTokenFromRequest(request) ??
    (searchParams ? getSessionTokenFromSearchParams(searchParams) : null);

  if (sessionToken) {
    let shopDomain: string;
    try {
      const payload = await decodeMerchantSessionToken(sessionToken, request);
      shopDomain = shopDomainFromSessionDest(payload.dest);
    } catch {
      throw new MerchantSessionError(
        "Invalid App Bridge session token",
        "invalid_token",
      );
    }

    const shop = await loadActiveShop(shopDomain);
    return { shop, shopDomain, sessionToken };
  }

  // ponytail: in-iframe nav keeps shop+host but drops id_token from URL
  if (searchParams) {
    const shopDomain = resolveShopFromEmbeddedParams(searchParams, request);
    if (shopDomain) {
      const shop = await loadActiveShop(shopDomain);
      return { shop, shopDomain, sessionToken: "" };
    }
  }

  throw new MerchantSessionError(
    "Missing App Bridge session token",
    "missing_token",
  );
}

export function buildSessionTokenBounceUrl(
  pathname: string,
  searchParams: URLSearchParams,
): string {
  const params = new URLSearchParams(searchParams);
  params.delete("id_token");

  const reloadParams = new URLSearchParams(params);
  params.set("shopify-reload", `${pathname}?${reloadParams.toString()}`);

  return `/app/session-token-bounce?${params.toString()}`;
}

export function requestFromHeaders(headerList: Headers): Request {
  return new Request("https://embedded.local/app", { headers: headerList });
}

export function searchParamsToUrlSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      params.set(key, value);
    } else if (Array.isArray(value)) {
      const first = value[0];
      if (first) {
        params.set(key, first);
      }
    }
  }
  return params;
}

export function isEmbeddedAdminRequest(
  searchParams: Record<string, string | string[] | undefined>,
): boolean {
  const shop =
    typeof searchParams.shop === "string"
      ? searchParams.shop
      : searchParams.shop?.[0];
  const host =
    typeof searchParams.host === "string"
      ? searchParams.host
      : searchParams.host?.[0];
  return Boolean(shop && host);
}

export function embeddedAppPath(
  pathname: string,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = searchParamsToUrlSearchParams(searchParams);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
