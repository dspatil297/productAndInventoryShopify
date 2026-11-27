import { NextResponse } from "next/server";
import { requireShopApiAccess, isShopApiAccessError } from "@/lib/shops/api-access";
import { getShopWithConfig, updateShopConfig } from "@/lib/db/shops";
import { readMetafieldDefinitionsFromConfig } from "@/lib/metafields/config";
import { refreshMetafieldDefinitionsForShop } from "@/lib/metafields/refresh-definitions";
import {
  buildDefaultImportSystemPrompt,
  filterDefinitionsByKeys,
  filterSchemaByKeys,
  mergeSystemPromptIntoSettings,
  readSelectedImportMetafields,
} from "@/lib/import/system-prompt";
import { buildImportPromptPack } from "@/lib/import/prompt-pack";
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
      selectedMetafields?: string[];
    };

    const hasSelectedMetafields = Array.isArray(body.selectedMetafields);
    const selectedMetafields = hasSelectedMetafields
      ? body.selectedMetafields!.filter(
          (item): item is string => typeof item === "string" && item.includes("."),
        )
      : undefined;

    if (body.action === "save") {
      const systemPrompt = String(body.systemPrompt ?? "").trim();
      if (!systemPrompt) {
        return NextResponse.json(
          { error: "System prompt cannot be empty" },
          { status: 400 },
        );
      }

      await updateShopConfig(shop.id, {
        settings: {
          importSystemPrompt: systemPrompt,
          ...(hasSelectedMetafields
            ? { selectedImportMetafields: selectedMetafields }
            : {}),
        },
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

      return NextResponse.json({ ok: true, systemPrompt, selectedMetafields });
    }

    if (body.action === "regenerate") {
      await refreshMetafieldDefinitionsForShop(shop);
      const refreshed = await getShopWithConfig(shop.id);
      const defList = readMetafieldDefinitionsFromConfig(refreshed?.config);
      const storedPack = readStoredImportPromptPack(refreshed?.config?.settings);
      const fullPack = await ensureImportPromptPack(shop.id, defList, storedPack);
      if (!fullPack) {
        return NextResponse.json(
          { error: "Could not build prompt pack from definitions" },
          { status: 400 },
        );
      }

      const activeSelected =
        selectedMetafields ??
        readSelectedImportMetafields(refreshed?.config?.settings);
      const filteredDefs = filterDefinitionsByKeys(defList, activeSelected);
      const filteredPack = activeSelected
        ? buildImportPromptPack(filteredDefs)
        : fullPack;

      const existingProfile = readStoreProfile(refreshed?.config?.settings);
      const filteredSchema = existingProfile?.schema
        ? filterSchemaByKeys(existingProfile.schema, activeSelected)
        : undefined;
      const systemPrompt = buildDefaultImportSystemPrompt(
        filteredPack,
        filteredSchema,
        existingProfile?.import_policy,
      );
      const currentSettings =
        typeof refreshed?.config?.settings === "object" &&
        refreshed.config.settings !== null &&
        !Array.isArray(refreshed.config.settings)
          ? (refreshed.config.settings as Record<string, unknown>)
          : {};

      await updateShopConfig(shop.id, {
        settings: {
          ...mergeSystemPromptIntoSettings(currentSettings, systemPrompt),
          ...(hasSelectedMetafields
            ? { selectedImportMetafields: selectedMetafields }
            : {}),
        },
      });

      await upsertStoreProfileForShop({
        shopId: shop.id,
        shopDomain: shop.shopDomain,
        definitions: defList,
        shop: refreshed ?? shop,
        systemPrompt,
        importPolicy: existingProfile?.import_policy,
        mappingConfig: existingProfile?.mapping_config,
      });

      return NextResponse.json({
        ok: true,
        systemPrompt,
        packVersion: fullPack.version,
        selectedMetafields: activeSelected ?? undefined,
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
