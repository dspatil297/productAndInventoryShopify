import {
  AgencyAuthError,
  requireAgencySessionUserFromRequest,
} from "@/lib/agency/auth";
import {
  getMerchantPortalSessionFromRequest,
} from "@/lib/merchant/auth";
import { getShopWithConfig } from "@/lib/db/shops";
import {
  MerchantSessionError,
  decodeMerchantSessionToken,
  getHostParam,
  getSessionTokenFromRequest,
  getShopParam,
  shopDomainFromSessionDest,
} from "@/lib/shopify/session";
import { getShopify } from "@/lib/shopify/shopify";

export type ShopWithConfig = NonNullable<
  Awaited<ReturnType<typeof getShopWithConfig>>
>;

export class ShopApiAccessError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ShopApiAccessError";
    this.status = status;
  }
}

export async function requireShopApiAccess(
  request: Request,
  shopId: string,
): Promise<ShopWithConfig> {
  try {
    await requireAgencySessionUserFromRequest(request);
    const shop = await getShopWithConfig(shopId);
    if (!shop) {
      throw new ShopApiAccessError("Store not found", 404);
    }
    if (!shop.isActive) {
      throw new ShopApiAccessError("Store is inactive", 400);
    }
    return shop;
  } catch (error) {
    if (!(error instanceof AgencyAuthError)) {
      throw error;
    }
  }

  const portalSession = getMerchantPortalSessionFromRequest(request);
  if (portalSession) {
    if (portalSession.shopId !== shopId) {
      throw new ShopApiAccessError("Forbidden", 403);
    }

    const shop = await getShopWithConfig(shopId);
    if (!shop) {
      throw new ShopApiAccessError("Store not found", 404);
    }
    if (!shop.isActive) {
      throw new ShopApiAccessError("Store is inactive", 400);
    }
    return shop;
  }

  const sessionToken = getSessionTokenFromRequest(request);
  if (sessionToken) {
    let shopDomain: string;
    try {
      const payload = await decodeMerchantSessionToken(sessionToken, request);
      shopDomain = shopDomainFromSessionDest(payload.dest);
    } catch {
      throw new ShopApiAccessError("Invalid session token", 401);
    }

    const shop = await getShopWithConfig(shopId);
    if (!shop || !shop.isActive) {
      throw new ShopApiAccessError("Store not found", 404);
    }

    if (shop.shopDomain !== shopDomain) {
      throw new ShopApiAccessError("Forbidden", 403);
    }

    return shop;
  }

  const url = new URL(request.url);
  const shopParam = getShopParam(url.searchParams);
  const hostParam = getHostParam(url.searchParams);
  if (shopParam && hostParam) {
    const shopDomain = getShopify(request).utils.sanitizeShop(shopParam, true);
    if (shopDomain) {
      const shop = await getShopWithConfig(shopId);
      if (!shop || !shop.isActive) {
        throw new ShopApiAccessError("Store not found", 404);
      }
      if (shop.shopDomain !== shopDomain) {
        throw new ShopApiAccessError("Forbidden", 403);
      }
      return shop;
    }
  }

  throw new ShopApiAccessError("Unauthorized", 401);
}

export function isShopApiAccessError(error: unknown): error is ShopApiAccessError {
  return error instanceof ShopApiAccessError;
}

export function isMerchantSessionError(error: unknown): error is MerchantSessionError {
  return error instanceof MerchantSessionError;
}
