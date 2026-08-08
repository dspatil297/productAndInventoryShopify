"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAgencySessionUser } from "@/lib/agency/auth";
import { getShopWithConfig, updateShopConfig } from "@/lib/db/shops";

const settingsSchema = z.object({
  shopId: z.string().uuid(),
  lowStockThreshold: z.coerce.number().int().min(0).max(100000),
  syncFrequency: z.enum(["manual", "hourly", "daily"]),
});

export async function updateStoreSettingsAction(formData: FormData): Promise<void> {
  await requireAgencySessionUser();

  const parsed = settingsSchema.safeParse({
    shopId: formData.get("shopId"),
    lowStockThreshold: formData.get("lowStockThreshold"),
    syncFrequency: formData.get("syncFrequency"),
  });

  if (!parsed.success) {
    redirect("/agency/stores?error=invalid_settings");
  }

  const shop = await getShopWithConfig(parsed.data.shopId);
  if (!shop) {
    redirect("/agency/stores?error=not_found");
  }

  await updateShopConfig(parsed.data.shopId, {
    lowStockThreshold: parsed.data.lowStockThreshold,
    settings: { syncFrequency: parsed.data.syncFrequency },
  });

  redirect(`/agency/stores/${parsed.data.shopId}?saved=1`);
}
