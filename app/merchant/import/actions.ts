"use server";

import { redirect } from "next/navigation";
import { updateShopConfig } from "@/lib/db/shops";
import { getShopWithConfig } from "@/lib/db/shops";
import { readMetafieldDefinitionsFromConfig } from "@/lib/metafields/config";
import { refreshMetafieldDefinitionsForShop } from "@/lib/metafields/refresh-definitions";
import {
  buildDefaultImportSystemPrompt,
  mergeSystemPromptIntoSettings,
} from "@/lib/import/system-prompt";
import { readStoreProfile } from "@/lib/import/spec/store-profile";
import { upsertStoreProfileForShop } from "@/lib/import/spec/store-profile";
import {
  ensureImportPromptPack,
  readStoredImportPromptPack,
} from "@/lib/import/sync-prompt-pack";
import {
  MerchantPortalAuthError,
  requireMerchantPortalShop,
} from "@/lib/merchant/auth";
import { isNextNavigationError } from "@/lib/server/next-navigation-error";

function redirectWithFlash(path: string, flash: Record<string, string>): never {
  const url = new URL(path, "https://local.invalid");
  for (const [key, value] of Object.entries(flash)) {
    url.searchParams.set(key, value);
  }
  redirect(`${url.pathname}${url.search}`);
}

export async function saveImportSystemPromptAction(
  formData: FormData,
): Promise<void> {
  let shop;
  try {
    shop = await requireMerchantPortalShop();
  } catch (error) {
    if (error instanceof MerchantPortalAuthError) {
      redirectWithFlash("/login", { error: "Session expired — sign in again" });
    }
    throw error;
  }

  const returnTo = String(formData.get("returnTo") ?? "/merchant/import?tab=ai");
  const safeReturn =
    returnTo.startsWith("/merchant/") && !returnTo.startsWith("//")
      ? returnTo
      : "/merchant/import?tab=ai";
  const systemPrompt = String(formData.get("systemPrompt") ?? "").trim();

  if (!systemPrompt) {
    redirectWithFlash(safeReturn, { error: "System prompt cannot be empty" });
  }

  try {
    await updateShopConfig(shop.id, {
      settings: { importSystemPrompt: systemPrompt },
    });
    const refreshed = await getShopWithConfig(shop.id);
    const definitions = readMetafieldDefinitionsFromConfig(refreshed?.config);
    const profile = readStoreProfile(refreshed?.config?.settings);
    if (profile) {
      await upsertStoreProfileForShop({
        shopId: shop.id,
        shopDomain: shop.shopDomain,
        definitions,
        shop: refreshed ?? shop,
        systemPrompt,
        importPolicy: profile.import_policy,
        mappingConfig: profile.mapping_config,
      });
    }
    redirectWithFlash(safeReturn, { promptSaved: "1" });
  } catch (error) {
    if (isNextNavigationError(error)) {
      throw error;
    }
    redirectWithFlash(safeReturn, {
      error: error instanceof Error ? error.message : "Could not save prompt",
    });
  }
}

export async function regenerateImportSystemPromptAction(
  formData: FormData,
): Promise<void> {
  let shop;
  try {
    shop = await requireMerchantPortalShop();
  } catch (error) {
    if (error instanceof MerchantPortalAuthError) {
      redirectWithFlash("/login", { error: "Session expired — sign in again" });
    }
    throw error;
  }

  const returnTo = String(formData.get("returnTo") ?? "/merchant/import?tab=ai");
  const safeReturn =
    returnTo.startsWith("/merchant/") && !returnTo.startsWith("//")
      ? returnTo
      : "/merchant/import?tab=ai";

  try {
    await refreshMetafieldDefinitionsForShop(shop);
    const refreshed = await getShopWithConfig(shop.id);
    const defList = readMetafieldDefinitionsFromConfig(refreshed?.config);
    const storedPack = readStoredImportPromptPack(refreshed?.config?.settings);
    const pack = await ensureImportPromptPack(shop.id, defList, storedPack);
    if (!pack) {
      redirectWithFlash(safeReturn, {
        error: "Refresh import columns first",
      });
    }

    const systemPrompt = buildDefaultImportSystemPrompt(pack);
    const currentSettings =
      typeof refreshed?.config?.settings === "object" &&
      refreshed.config.settings !== null &&
      !Array.isArray(refreshed.config.settings)
        ? (refreshed.config.settings as Record<string, unknown>)
        : {};

    await updateShopConfig(shop.id, {
      settings: mergeSystemPromptIntoSettings(currentSettings, systemPrompt),
    });
    redirectWithFlash(safeReturn, { promptRegenerated: "1" });
  } catch (error) {
    if (isNextNavigationError(error)) {
      throw error;
    }
    redirectWithFlash(safeReturn, {
      error:
        error instanceof Error ? error.message : "Could not regenerate prompt",
    });
  }
}

export async function prepareImportDataAction(formData: FormData): Promise<void> {
  let shop;
  try {
    shop = await requireMerchantPortalShop();
  } catch (error) {
    if (error instanceof MerchantPortalAuthError) {
      redirectWithFlash("/login", { error: "Session expired — sign in again" });
    }
    throw error;
  }

  const returnTo = String(formData.get("returnTo") ?? "");
  const safeReturn =
    returnTo.startsWith("/merchant/") && !returnTo.startsWith("//")
      ? returnTo
      : "/merchant/import";

  try {
    await refreshMetafieldDefinitionsForShop(shop);
    const refreshed = await getShopWithConfig(shop.id);
    const defCount = Array.isArray(refreshed?.config?.metafieldDefinitions)
      ? (refreshed.config.metafieldDefinitions as unknown[]).length
      : 0;
    redirectWithFlash(safeReturn, {
      prepared: "1",
      defs: String(defCount),
    });
  } catch (error) {
    if (isNextNavigationError(error)) {
      throw error;
    }
    redirectWithFlash(safeReturn, {
      error:
        error instanceof Error
          ? error.message
          : "Could not refresh import template data",
    });
  }
}
