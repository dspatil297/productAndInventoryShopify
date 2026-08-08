import type { ShopConfig } from "@/generated/prisma/client";

export function readProductTypesFromConfig(
  config: ShopConfig | null | undefined,
): string[] {
  const raw = config?.productTypes;
  if (!Array.isArray(raw)) {
    return [];
  }

  return [...new Set(raw.filter((value): value is string => typeof value === "string" && value.length > 0))]
    .sort((a, b) => a.localeCompare(b));
}
