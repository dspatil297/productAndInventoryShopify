import { randomUUID } from "node:crypto";
import type { Shop } from "@/generated/prisma/client";
import {
  INVENTORY_ADJUST_REASON,
  INVENTORY_QUANTITY_NAME,
} from "@/lib/inventory/constants";
import { ensureInventoryEditable } from "@/lib/inventory/ensure-editable";
import type { InventoryWriteResult } from "@/lib/inventory/types";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import {
  INVENTORY_ADJUST_QUANTITIES_MUTATION,
  INVENTORY_MOVE_QUANTITIES_MUTATION,
} from "@/lib/shopify/mutations";

export interface InventoryMoveInput {
  inventoryItemId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
}

interface MoveGraphqlResponse {
  inventoryMoveQuantities: {
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

interface AdjustGraphqlResponse {
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

async function moveViaAdjust(
  shop: Shop,
  move: InventoryMoveInput,
  idempotencyKey: string,
): Promise<InventoryWriteResult> {
  const data = await shopifyGraphqlForShop<AdjustGraphqlResponse>(
    shop,
    INVENTORY_ADJUST_QUANTITIES_MUTATION,
    {
      input: {
        name: INVENTORY_QUANTITY_NAME,
        reason: INVENTORY_ADJUST_REASON,
        referenceDocumentUri: `app://inventory/move/${shop.id}/${Date.now()}`,
        changes: [
          {
            inventoryItemId: move.inventoryItemId,
            locationId: move.fromLocationId,
            delta: -move.quantity,
          },
          {
            inventoryItemId: move.inventoryItemId,
            locationId: move.toLocationId,
            delta: move.quantity,
          },
        ],
      },
      idempotencyKey,
    },
  );

  const errors = data.inventoryAdjustQuantities.userErrors.map((error) => ({
    message: error.message,
    inventoryItemId: move.inventoryItemId,
  }));

  if (errors.length > 0) {
    return { updated: 0, errors };
  }

  return {
    updated: data.inventoryAdjustQuantities.inventoryAdjustmentGroup ? 1 : 0,
    errors: [],
  };
}

async function moveOne(
  shop: Shop,
  move: InventoryMoveInput,
  idempotencyKey: string,
): Promise<InventoryWriteResult> {
  if (move.fromLocationId === move.toLocationId) {
    return {
      updated: 0,
      errors: [
        {
          message: "Source and destination location must differ",
          inventoryItemId: move.inventoryItemId,
        },
      ],
    };
  }

  if (move.quantity <= 0) {
    return {
      updated: 0,
      errors: [
        {
          message: "Move quantity must be > 0",
          inventoryItemId: move.inventoryItemId,
        },
      ],
    };
  }

  const ensured = await ensureInventoryEditable(
    shop,
    move.inventoryItemId,
    move.toLocationId,
    0,
  );

  if (ensured.error) {
    return {
      updated: 0,
      errors: [
        { message: ensured.error, inventoryItemId: move.inventoryItemId },
      ],
    };
  }

  // Try native move (supports from/to location ids); fall back to dual adjust
  const moved = await shopifyGraphqlForShop<MoveGraphqlResponse>(
    shop,
    INVENTORY_MOVE_QUANTITIES_MUTATION,
    {
      input: {
        reason: "correction",
        referenceDocumentUri: `app://inventory/move/${shop.id}/${Date.now()}`,
        changes: [
          {
            quantity: move.quantity,
            inventoryItemId: move.inventoryItemId,
            from: {
              locationId: move.fromLocationId,
              name: "available",
              changeFromQuantity: null,
            },
            to: {
              locationId: move.toLocationId,
              name: "available",
              changeFromQuantity: null,
            },
          },
        ],
      },
      idempotencyKey: `${idempotencyKey}:move`,
    },
  );

  if (moved.inventoryMoveQuantities.userErrors.length === 0) {
    return {
      updated: moved.inventoryMoveQuantities.inventoryAdjustmentGroup ? 1 : 0,
      errors: [],
    };
  }

  // ponytail: Shopify often rejects cross-location move — dual adjust works
  return moveViaAdjust(shop, move, `${idempotencyKey}:adjust`);
}

export async function moveShopInventoryQuantities(
  shop: Shop,
  moves: InventoryMoveInput[],
  options?: { idempotencyKey?: string },
): Promise<InventoryWriteResult> {
  if (moves.length === 0) {
    return { updated: 0, errors: [] };
  }

  let updated = 0;
  const errors: InventoryWriteResult["errors"] = [];
  const baseKey = options?.idempotencyKey ?? randomUUID();

  for (const [index, move] of moves.entries()) {
    const result = await moveOne(shop, move, `${baseKey}:${index}`);
    updated += result.updated;
    errors.push(...result.errors);
  }

  return { updated, errors };
}
