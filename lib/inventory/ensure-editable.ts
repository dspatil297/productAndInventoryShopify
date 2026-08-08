import { randomUUID } from "node:crypto";
import type { Shop } from "@/generated/prisma/client";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import {
  INVENTORY_ACTIVATE_MUTATION,
  INVENTORY_ITEM_UPDATE_MUTATION,
} from "@/lib/shopify/mutations";
import { INVENTORY_ITEM_STATE_QUERY } from "@/lib/shopify/queries";

interface InventoryItemStateResponse {
  inventoryItem: {
    id: string;
    tracked: boolean;
    inventoryLevel: { id: string } | null;
  } | null;
}

interface InventoryItemUpdateResponse {
  inventoryItemUpdate: {
    inventoryItem: { id: string; tracked: boolean } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

interface InventoryActivateResponse {
  inventoryActivate: {
    inventoryLevel: {
      id: string;
      quantities: Array<{ name: string; quantity: number }>;
    } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

export interface EnsureInventoryEditableResult {
  tracked: boolean;
  activated: boolean;
  /** true when activate set the qty — caller can skip set/adjust */
  quantityApplied: boolean;
  error?: string;
}

async function enableTracking(
  shop: Shop,
  inventoryItemId: string,
): Promise<string | null> {
  const data = await shopifyGraphqlForShop<InventoryItemUpdateResponse>(
    shop,
    INVENTORY_ITEM_UPDATE_MUTATION,
    {
      id: inventoryItemId,
      input: { tracked: true },
    },
  );

  if (data.inventoryItemUpdate.userErrors.length > 0) {
    return data.inventoryItemUpdate.userErrors[0]?.message ?? "Failed to enable tracking";
  }

  return null;
}

async function activateAtLocation(
  shop: Shop,
  inventoryItemId: string,
  locationId: string,
  available: number,
): Promise<{ error?: string; applied: boolean }> {
  const data = await shopifyGraphqlForShop<InventoryActivateResponse>(
    shop,
    INVENTORY_ACTIVATE_MUTATION,
    {
      inventoryItemId,
      locationId,
      available,
      idempotencyKey: randomUUID(),
    },
  );

  if (data.inventoryActivate.userErrors.length > 0) {
    return {
      error:
        data.inventoryActivate.userErrors[0]?.message ??
        "Failed to activate inventory at location",
      applied: false,
    };
  }

  return { applied: data.inventoryActivate.inventoryLevel !== null };
}

/**
 * Enable tracking + stock at location when needed so set/adjust can run.
 * If item had no level, activates with `initialAvailable` (set path uses target qty).
 */
export async function ensureInventoryEditable(
  shop: Shop,
  inventoryItemId: string,
  locationId: string,
  initialAvailable = 0,
): Promise<EnsureInventoryEditableResult> {
  const state = await shopifyGraphqlForShop<InventoryItemStateResponse>(
    shop,
    INVENTORY_ITEM_STATE_QUERY,
    { id: inventoryItemId, locationId },
  );

  const item = state.inventoryItem;
  if (!item) {
    return {
      tracked: false,
      activated: false,
      quantityApplied: false,
      error: "Inventory item not found",
    };
  }

  let tracked = item.tracked;
  if (!tracked) {
    const trackError = await enableTracking(shop, inventoryItemId);
    if (trackError) {
      return {
        tracked: false,
        activated: false,
        quantityApplied: false,
        error: trackError,
      };
    }
    tracked = true;
  }

  if (item.inventoryLevel) {
    return { tracked, activated: true, quantityApplied: false };
  }

  const activate = await activateAtLocation(
    shop,
    inventoryItemId,
    locationId,
    initialAvailable,
  );

  if (activate.error) {
    return {
      tracked,
      activated: false,
      quantityApplied: false,
      error: activate.error,
    };
  }

  return {
    tracked,
    activated: true,
    quantityApplied: activate.applied,
  };
}
