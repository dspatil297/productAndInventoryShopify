import { ensureInventoryEditable } from "@/lib/inventory/ensure-editable";
import type { InventoryWriteResult } from "@/lib/inventory/types";
import type { Shop } from "@/generated/prisma/client";

export async function enableShopInventoryTracking(
  shop: Shop,
  items: Array<{ inventoryItemId: string; locationId: string }>,
): Promise<InventoryWriteResult> {
  if (items.length === 0) {
    return { updated: 0, errors: [] };
  }

  let updated = 0;
  const errors: InventoryWriteResult["errors"] = [];

  for (const item of items) {
    const result = await ensureInventoryEditable(
      shop,
      item.inventoryItemId,
      item.locationId,
      0,
    );

    if (result.error) {
      errors.push({
        message: result.error,
        inventoryItemId: item.inventoryItemId,
      });
      continue;
    }

    updated += 1;
  }

  return { updated, errors };
}
