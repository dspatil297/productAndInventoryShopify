import { NextResponse } from "next/server";
import { readLocationsFromConfig } from "@/lib/inventory/locations";
import { getShopLocations } from "@/lib/inventory/refresh-locations";
import {
  ShopApiAccessError,
  isShopApiAccessError,
  requireShopApiAccess,
} from "@/lib/shops/api-access";

interface RouteContext {
  params: Promise<{ shopId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { shopId } = await context.params;

  try {
    const shop = await requireShopApiAccess(request, shopId);
    const url = new URL(request.url);
    const live = url.searchParams.get("live") === "1";
    const cached = readLocationsFromConfig(shop.config);
    const locations =
      live || cached.length === 0
        ? await getShopLocations(shop, { live: true })
        : cached;

    return NextResponse.json({
      locations,
      lastSyncedAt: shop.config?.lastSyncedAt ?? null,
      source: live || cached.length === 0 ? "live" : "cache",
    });
  } catch (error) {
    if (isShopApiAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { shopId } = await context.params;

  try {
    const shop = await requireShopApiAccess(request, shopId);
    const locations = await getShopLocations(shop, { live: true });
    return NextResponse.json({
      locations,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (isShopApiAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
