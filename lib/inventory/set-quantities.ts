import { randomUUID } from "node:crypto";
import type { Shop } from "@/generated/prisma/client";
import {
  INVENTORY_QUANTITY_NAME,
  INVENTORY_SET_REASON,
} from "@/lib/inventory/constants";
import { ensureInventoryEditable } from "@/lib/inventory/ensure-editable";
import type {
  InventorySetInput,
  InventoryWriteResult,
} from "@/lib/inventory/types";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import { INVENTORY_SET_QUANTITIES_MUTATION } from "@/lib/shopify/mutations";

interface InventorySetGraphqlResponse {
  inventorySetQuantities: {
    inventoryAdjustmentGroup: {
      reason: string;
      changes: Array<{
        name: string;
        delta: number;
        quantityAfterChange: number | null;
      }>;
    } | null;
    userErrors: Array<{
      field: string[] | null;
      message: string;
      code: string | null;
    }>;
  };
}

async function setOne(
  shop: Shop,
  update: InventorySetInput,
  idempotencyKey: string,
): Promise<InventoryWriteResult> {
  const ensured = await ensureInventoryEditable(
    shop,
    update.inventoryItemId,
    update.locationId,
    update.quantity,
  );

  if (ensured.error) {
    return {
      updated: 0,
      errors: [{ message: ensured.error, inventoryItemId: update.inventoryItemId }],
    };
  }

  if (ensured.quantityApplied) {
    return { updated: 1, errors: [] };
  }

  const data = await shopifyGraphqlForShop<InventorySetGraphqlResponse>(
    shop,
    INVENTORY_SET_QUANTITIES_MUTATION,
    {
      input: {
        name: INVENTORY_QUANTITY_NAME,
        reason: INVENTORY_SET_REASON,
        referenceDocumentUri: `app://inventory/set/${shop.id}/${Date.now()}`,
        quantities: [
          {
            inventoryItemId: update.inventoryItemId,
            locationId: update.locationId,
            quantity: update.quantity,
            changeFromQuantity: update.changeFromQuantity,
          },
        ],
      },
      idempotencyKey,
    },
  );

  const errors = data.inventorySetQuantities.userErrors.map((error) => ({
    message: error.message,
    inventoryItemId: update.inventoryItemId,
  }));

  if (errors.length > 0) {
    return { updated: 0, errors };
  }

  return {
    updated: data.inventorySetQuantities.inventoryAdjustmentGroup?.changes.length
      ? 1
      : 0,
    errors: [],
  };
}

export async function setShopInventoryQuantities(
  shop: Shop,
  updates: InventorySetInput[],
  options?: { idempotencyKey?: string },
): Promise<InventoryWriteResult> {
  if (updates.length === 0) {
    return { updated: 0, errors: [] };
  }

  let updated = 0;
  const errors: InventoryWriteResult["errors"] = [];
  const baseKey = options?.idempotencyKey ?? randomUUID();

  for (const [index, update] of updates.entries()) {
    const result = await setOne(shop, update, `${baseKey}:${index}`);
    updated += result.updated;
    errors.push(...result.errors);
  }

  return { updated, errors };
}
