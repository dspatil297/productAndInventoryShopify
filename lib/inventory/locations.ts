import type { ShopConfig } from "@/generated/prisma/client";
import type { ShopLocation } from "@/lib/inventory/types";

function isShopLocation(value: unknown): value is ShopLocation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.isActive === "boolean"
  );
}

export function readLocationsFromConfig(
  config: Pick<ShopConfig, "locations"> | null | undefined,
): ShopLocation[] {
  const raw = config?.locations;
  if (!Array.isArray(raw)) {
    return [];
  }

  return (raw as unknown[])
    .filter((value): value is ShopLocation => isShopLocation(value))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function locationNumericId(locationGid: string): string {
  const parts = locationGid.split("/");
  return parts[parts.length - 1] ?? locationGid;
}

export function findLocationById(
  locations: ShopLocation[],
  locationId: string | null | undefined,
): ShopLocation | null {
  if (!locationId) {
    return null;
  }
  return locations.find((location) => location.id === locationId) ?? null;
}

export function pickDefaultLocation(
  locations: ShopLocation[],
): ShopLocation | null {
  const active = locations.find((location) => location.isActive);
  return active ?? locations[0] ?? null;
}
