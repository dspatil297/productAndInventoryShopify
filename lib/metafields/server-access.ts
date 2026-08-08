import { headers } from "next/headers";
import {
  ShopApiAccessError,
  requireShopApiAccess,
  type ShopWithConfig,
} from "@/lib/shops/api-access";

interface ShopAccessOptions {
  shop?: string;
  host?: string;
  sessionToken?: string;
}

export async function requireShopAccessForAction(
  shopId: string,
  options: ShopAccessOptions = {},
): Promise<ShopWithConfig> {
  const incoming = await headers();
  const requestHeaders = new Headers(incoming);

  if (options.sessionToken) {
    requestHeaders.set("Authorization", `Bearer ${options.sessionToken}`);
  }

  const url = new URL(`https://embedded.local/api/shops/${shopId}`);
  if (options.shop && options.host) {
    url.searchParams.set("shop", options.shop);
    url.searchParams.set("host", options.host);
  }

  return requireShopApiAccess(new Request(url, { headers: requestHeaders }), shopId);
}

export function shopAccessErrorMessage(error: unknown): string {
  if (error instanceof ShopApiAccessError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Request failed";
}
