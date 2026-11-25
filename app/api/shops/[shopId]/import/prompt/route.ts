import { NextResponse } from "next/server";
import { requireShopApiAccess, isShopApiAccessError } from "@/lib/shops/api-access";
import { getShopWithConfig, updateShopConfig } from "@/lib/db/shops";
import { readMetafieldDefinitionsFromConfig } from "@/lib/metafields/config";
import { refreshMetafieldDefinitionsForShop } from "@/lib/metafields/refresh-definitions";
import {
  buildDefaultImportSystemPrompt,
  mergeSystemPromptIntoSettings,
} from "@/lib/import/system-prompt";
import {
  ensureImportPromptPack,
  readStoredImportPromptPack,
} from "@/lib/import/sync-prompt-pack";
import { readStoreProfile, upsertStoreProfileForShop } from "@/lib/import/spec/store-profile";

interface RouteContext {
  params: Promise<{ shopId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { shopId } = await context.params;

  try {
    const shop = await requireShopApiAccess(request, shopId);
    const body = (await request.json().catch(() => ({}))) as {
      action?: "save" | "regenerate";
      systemPrompt?: string;
    };

    if (body.action === "save") {
      const systemPrompt = String(body.systemPrompt ?? "").trim();
      if (!systemPrompt) {
        return NextResponse.json(
          { error: "System prompt cannot be empty" },
          { status: 400 },
        );
      }

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

      return NextResponse.json({ ok: true, systemPrompt });
    }

    if (body.action === "regenerate") {
      await refreshMetafieldDefinitionsForShop(shop);
      const refreshed = await getShopWithConfig(shop.id);
      const defList = readMetafieldDefinitionsFromConfig(refreshed?.config);
      const storedPack = readStoredImportPromptPack(refreshed?.config?.settings);
      const pack = await ensureImportPromptPack(shop.id, defList, storedPack);
      if (!pack) {
        return NextResponse.json(
          { error: "Could not build prompt pack from definitions" },
          { status: 400 },
        );
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

      return NextResponse.json({
        ok: true,
        systemPrompt,
        packVersion: pack.version,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (isShopApiAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Prompt action failed" },
      { status: 500 },
    );
  }
}
