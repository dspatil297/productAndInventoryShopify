import type { Shop } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { prisma, withDbRetry } from "@/lib/db/prisma";
import { decrypt, encrypt } from "@/lib/encryption";

export interface UpsertShopInput {
  shopDomain: string;
  shopName: string;
  shopEmail?: string | null;
  shopifyShopId: string;
  planName?: string | null;
  accessToken: string;
  scope?: string | null;
  currencyCode: string;
  timezone: string;
  agencyUserId?: string | null;
}

export async function upsertShop(input: UpsertShopInput): Promise<Shop> {
  const encryptedToken = encrypt(input.accessToken);

  return prisma.shop.upsert({
    where: { shopDomain: input.shopDomain },
    create: {
      shopDomain: input.shopDomain,
      shopName: input.shopName,
      shopEmail: input.shopEmail,
      shopifyShopId: input.shopifyShopId,
      planName: input.planName,
      accessToken: encryptedToken,
      scope: input.scope,
      currencyCode: input.currencyCode,
      timezone: input.timezone,
      agencyUserId: input.agencyUserId,
      isActive: true,
      installedAt: new Date(),
      uninstalledAt: null,
    },
    update: {
      shopName: input.shopName,
      shopEmail: input.shopEmail,
      shopifyShopId: input.shopifyShopId,
      planName: input.planName,
      accessToken: encryptedToken,
      scope: input.scope,
      currencyCode: input.currencyCode,
      timezone: input.timezone,
      isActive: true,
      uninstalledAt: null,
    },
  });
}

export async function getShopByDomain(shopDomain: string): Promise<Shop | null> {
  return withDbRetry(() => prisma.shop.findUnique({ where: { shopDomain } }));
}

export async function getActiveShopByDomain(
  shopDomain: string,
): Promise<Shop | null> {
  return withDbRetry(() =>
    prisma.shop.findFirst({
      where: { shopDomain, isActive: true },
    }),
  );
}

export function getShopAccessToken(shop: Shop): string {
  return decrypt(shop.accessToken);
}

export async function markShopInactive(shopDomain: string): Promise<void> {
  await prisma.shop.updateMany({
    where: { shopDomain },
    data: {
      isActive: false,
      uninstalledAt: new Date(),
    },
  });
}

export async function deleteShopSessions(shopDomain: string): Promise<void> {
  await prisma.shopifySession.deleteMany({ where: { shop: shopDomain } });
}

export async function listShopsWithConfig() {
  return withDbRetry(() =>
    prisma.shop.findMany({
      include: { config: true },
      orderBy: { installedAt: "desc" },
    }),
  );
}

export async function getShopWithConfig(shopId: string) {
  return withDbRetry(() =>
    prisma.shop.findUnique({
      where: { id: shopId },
      include: { config: true },
    }),
  );
}

export async function disconnectShop(
  shopId: string,
  options?: { purgeToken?: boolean },
): Promise<void> {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    return;
  }

  await prisma.shop.update({
    where: { id: shopId },
    data: {
      isActive: false,
      uninstalledAt: new Date(),
      ...(options?.purgeToken ? { accessToken: encrypt("REVOKED") } : {}),
    },
  });

  await deleteShopSessions(shop.shopDomain);
}

export async function updateShopConfig(
  shopId: string,
  data: { lowStockThreshold?: number; settings?: Record<string, unknown> },
) {
  return withDbRetry(async () => {
    const existing = await prisma.shopConfig.findUnique({
      where: { shopId },
    });
    if (!existing) {
      return null;
    }

    const currentSettings =
      typeof existing.settings === "object" && existing.settings !== null
        ? (existing.settings as Record<string, unknown>)
        : {};

    return prisma.shopConfig.update({
      where: { shopId },
      data: {
        ...(data.lowStockThreshold !== undefined
          ? { lowStockThreshold: data.lowStockThreshold }
          : {}),
        ...(data.settings
          ? {
              settings: { ...currentSettings, ...data.settings } as Prisma.InputJsonValue,
            }
          : {}),
      },
    });
  });
}
