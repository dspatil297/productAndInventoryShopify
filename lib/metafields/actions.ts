"use server";

import { revalidatePath } from "next/cache";
import { refreshMetafieldDefinitionsForShop } from "@/lib/metafields/refresh-definitions";
import {
  requireShopAccessForAction,
  shopAccessErrorMessage,
} from "@/lib/metafields/server-access";
import { setShopMetafields } from "@/lib/metafields/set-metafields";
import type {
  MetafieldSaveResult,
  MetafieldUpdateInput,
} from "@/lib/metafields/types";

interface EmbeddedContext {
  shop?: string;
  host?: string;
  sessionToken?: string;
}

export async function refreshMetafieldDefinitionsAction(
  shopId: string,
  embedded: EmbeddedContext = {},
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    const shop = await requireShopAccessForAction(shopId, embedded);
    const definitions = await refreshMetafieldDefinitionsForShop(shop);
    revalidatePath("/app/metafields");
    revalidatePath(`/agency/stores/${shopId}/metafields`);
    return { ok: true, count: definitions.length };
  } catch (error) {
    return { ok: false, error: shopAccessErrorMessage(error) };
  }
}

export async function saveMetafieldsAction(
  shopId: string,
  updates: MetafieldUpdateInput[],
  embedded: EmbeddedContext = {},
): Promise<MetafieldSaveResult & { error?: string }> {
  if (updates.length === 0) {
    return { saved: 0, errors: [], error: "No changes to save" };
  }

  try {
    const shop = await requireShopAccessForAction(shopId, embedded);
    const result = await setShopMetafields(shop, updates);
    revalidatePath("/app/metafields");
    revalidatePath(`/agency/stores/${shopId}/metafields`);
    return result;
  } catch (error) {
    return { saved: 0, errors: [], error: shopAccessErrorMessage(error) };
  }
}
