import { randomUUID } from "node:crypto";
import type { Shop } from "@/generated/prisma/client";
import {
  INVENTORY_ADJUST_REASON,
  INVENTORY_QUANTITY_NAME,
} from "@/lib/inventory/constants";
import { ensureInventoryEditable } from "@/lib/inventory/ensure-editable";
import type {
  InventoryAdjustInput,
  InventoryWriteResult,
} from "@/lib/inventory/types";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import { INVENTORY_ADJUST_QUANTITIES_MUTATION } from "@/lib/shopify/mutations";

interface InventoryAdjustGraphqlResponse {
  inventoryAdjustQuantities: {
    inventoryAdjustmentGroup: {
      reason: string;
      changes: Array<{ name: string; delta: number }>;
    } | null;
    userErrors: Array<{
      field: string[] | null;
      message: string;
      code: string | null;
    }>;
  };
}

async function adjustOne(
  shop: Shop,
  change: InventoryAdjustInput,
  idempotencyKey: string,
): Promise<InventoryWriteResult> {
  const initialAvailable = change.delta > 0 ? change.delta : 0;
  const ensured = await ensureInventoryEditable(
    shop,
    change.inventoryItemId,
    change.locationId,
    initialAvailable,
  );

  if (ensured.error) {
    return {
      updated: 0,
      errors: [{ message: ensured.error, inventoryItemId: change.inventoryItemId }],
    };
  }

  if (ensured.quantityApplied) {
    return { updated: 1, errors: [] };
  }

  const data = await shopifyGraphqlForShop<InventoryAdjustGraphqlResponse>(
    shop,
    INVENTORY_ADJUST_QUANTITIES_MUTATION,
    {
      input: {
        name: INVENTORY_QUANTITY_NAME,
        reason: INVENTORY_ADJUST_REASON,
        referenceDocumentUri: `app://inventory/adjust/${shop.id}/${Date.now()}`,
        changes: [
          {
            inventoryItemId: change.inventoryItemId,
            locationId: change.locationId,
            delta: change.delta,
          },
        ],
      },
      idempotencyKey,
    },
  );

  const errors = data.inventoryAdjustQuantities.userErrors.map((error) => ({
    message: error.message,
    inventoryItemId: change.inventoryItemId,
  }));

  if (errors.length > 0) {
    return { updated: 0, errors };
  }

  return {
    updated: data.inventoryAdjustQuantities.inventoryAdjustmentGroup?.changes
      .length
      ? 1
      : 0,
    errors: [],
  };
}

export async function adjustShopInventoryQuantities(
  shop: Shop,
  changes: InventoryAdjustInput[],
  options?: { idempotencyKey?: string },
): Promise<InventoryWriteResult> {
  if (changes.length === 0) {
    return { updated: 0, errors: [] };
  }

  let updated = 0;
  const errors: InventoryWriteResult["errors"] = [];
  const baseKey = options?.idempotencyKey ?? randomUUID();

  for (const [index, change] of changes.entries()) {
    const result = await adjustOne(shop, change, `${baseKey}:${index}`);
    updated += result.updated;
    errors.push(...result.errors);
  }

  return { updated, errors };
}
