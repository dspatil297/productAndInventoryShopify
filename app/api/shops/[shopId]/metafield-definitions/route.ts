import { NextResponse } from "next/server";
import { readMetafieldDefinitionsFromConfig } from "@/lib/metafields/config";
import { refreshMetafieldDefinitionsForShop } from "@/lib/metafields/refresh-definitions";
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
    const definitions = readMetafieldDefinitionsFromConfig(shop.config);
    return NextResponse.json({
      definitions,
      lastSyncedAt: shop.config?.lastSyncedAt ?? null,
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
    const definitions = await refreshMetafieldDefinitionsForShop(shop);
    return NextResponse.json({
      definitions,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (isShopApiAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
