"use server";

import { redirect } from "next/navigation";
import {
  MerchantPortalAuthError,
  requireMerchantPortalShop,
} from "@/lib/merchant/auth";
import { syncThemeProductTemplates } from "@/lib/products/theme-templates";
import { isNextNavigationError } from "@/lib/server/next-navigation-error";

function redirectWithFlash(path: string, flash: Record<string, string>): never {
  const url = new URL(path, "https://local.invalid");
  for (const [key, value] of Object.entries(flash)) {
    url.searchParams.set(key, value);
  }
  redirect(`${url.pathname}${url.search}`);
}

export async function syncThemeTemplatesAction(
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

  const returnTo = String(formData.get("returnTo") ?? "");
  const safeReturn =
    returnTo.startsWith("/merchant/") && !returnTo.startsWith("//")
      ? returnTo
      : "/merchant/products/new?view=visual";

  let state;
  try {
    state = await syncThemeProductTemplates(shop);
  } catch (error) {
    if (isNextNavigationError(error)) {
      throw error;
    }
    redirectWithFlash(safeReturn, {
      error:
        error instanceof Error
          ? error.message
          : "Theme template sync failed",
    });
  }

  redirectWithFlash(safeReturn, {
    synced: "1",
    templates: String(state.templates.length),
  });
}
