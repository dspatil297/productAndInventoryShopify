import type { Shop, ShopConfig } from "@/generated/prisma/client";

type ShopWithConfig = Shop & { config: ShopConfig | null };

function readProductCount(config: ShopConfig | null): number | null {
  if (!config?.settings || typeof config.settings !== "object") {
    return null;
  }
  const count = (config.settings as Record<string, unknown>).productCount;
  return typeof count === "number" ? count : null;
}

function readJsonArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export interface AgencyStoreSummary {
  id: string;
  shopDomain: string;
  shopName: string;
  planName: string | null;
  currencyCode: string;
  timezone: string;
  isActive: boolean;
  installedAt: string;
  lastSyncedAt: string | null;
  productCount: number | null;
  locationCount: number;
  metafieldDefCount: number;
  lowStockThreshold: number;
  syncFrequency: "manual" | "hourly" | "daily";
}

function readSyncFrequency(
  config: ShopConfig | null,
): "manual" | "hourly" | "daily" {
  if (!config?.settings || typeof config.settings !== "object") {
    return "manual";
  }
  const value = (config.settings as Record<string, unknown>).syncFrequency;
  if (value === "hourly" || value === "daily") {
    return value;
  }
  return "manual";
}

export function toAgencyStoreSummary(shop: ShopWithConfig): AgencyStoreSummary {
  return {
    id: shop.id,
    shopDomain: shop.shopDomain,
    shopName: shop.shopName,
    planName: shop.planName,
    currencyCode: shop.currencyCode,
    timezone: shop.timezone,
    isActive: shop.isActive,
    installedAt: shop.installedAt.toISOString(),
    lastSyncedAt: shop.config?.lastSyncedAt?.toISOString() ?? null,
    productCount: readProductCount(shop.config),
    locationCount: readJsonArrayLength(shop.config?.locations),
    metafieldDefCount: readJsonArrayLength(shop.config?.metafieldDefinitions),
    lowStockThreshold: shop.config?.lowStockThreshold ?? 5,
    syncFrequency: readSyncFrequency(shop.config),
  };
}

export function sumProductCounts(stores: AgencyStoreSummary[]): number {
  return stores.reduce((total, store) => total + (store.productCount ?? 0), 0);
}
