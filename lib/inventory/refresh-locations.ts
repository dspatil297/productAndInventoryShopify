import type { Shop } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { ShopLocation } from "@/lib/inventory/types";
import { readLocationsFromConfig } from "@/lib/inventory/locations";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import { LOCATIONS_QUERY } from "@/lib/shopify/queries";

interface LocationsResponse {
  locations: {
    nodes: Array<{
      id: string;
      name: string;
      isActive: boolean;
      address: { city: string | null; country: string | null } | null;
    }>;
  };
}

type ShopWithLocationsConfig = Shop & {
  config?: { locations: Prisma.JsonValue } | null;
};

export async function refreshLocationsForShop(
  shop: Shop,
): Promise<ShopLocation[]> {
  const data = await shopifyGraphqlForShop<LocationsResponse>(
    shop,
    LOCATIONS_QUERY,
    { first: 50 },
  );

  const locations = data.locations.nodes as ShopLocation[];

  await prisma.shopConfig.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      locations: locations as unknown as Prisma.InputJsonValue,
      lastSyncedAt: new Date(),
    },
    update: {
      locations: locations as unknown as Prisma.InputJsonValue,
      lastSyncedAt: new Date(),
    },
  });

  return locations.sort((left, right) => left.name.localeCompare(right.name));
}

export async function getShopLocations(
  shop: ShopWithLocationsConfig,
  options?: { live?: boolean },
): Promise<ShopLocation[]> {
  if (options?.live) {
    return refreshLocationsForShop(shop);
  }

  const cached = readLocationsFromConfig(shop.config ?? null);
  if (cached.length > 0) {
    return cached;
  }

  return refreshLocationsForShop(shop);
}
