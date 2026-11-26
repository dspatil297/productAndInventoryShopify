import type { Prisma } from "@/generated/prisma/client";
import { prisma, withDbRetry } from "@/lib/db/prisma";
import {
  buildDefaultImportSystemPrompt,
  isLegacySystemPrompt,
  mergeSystemPromptIntoSettings,
  readImportSystemPromptFromSettings,
} from "@/lib/import/system-prompt";
import { upsertStoreProfileForShop } from "@/lib/import/spec/store-profile";
import {
  buildImportPromptPack,
  mergeImportPromptPackIntoSettings,
  readImportPromptPackFromSettings,
  type ImportPromptPack,
} from "@/lib/import/prompt-pack";
import type { MetafieldDefinitionNode } from "@/types/shopify";

function readSettingsRecord(
  settings: Prisma.JsonValue | null | undefined,
): Record<string, unknown> {
  if (typeof settings === "object" && settings !== null && !Array.isArray(settings)) {
    return settings as Record<string, unknown>;
  }
  return {};
}

export async function upsertImportPromptPackForShop(
  shopId: string,
  definitions: MetafieldDefinitionNode[],
): Promise<ImportPromptPack> {
  const pack = buildImportPromptPack(definitions);
  const existing = await withDbRetry(() =>
    prisma.shopConfig.findUnique({
      where: { shopId },
      select: { settings: true },
    }),
  );
  const settings = readSettingsRecord(existing?.settings);
  let nextSettings = mergeImportPromptPackIntoSettings(settings, pack);
  const existingPrompt = readImportSystemPromptFromSettings(
    nextSettings as Prisma.JsonValue,
  );
  if (isLegacySystemPrompt(existingPrompt)) {
    nextSettings = mergeSystemPromptIntoSettings(
      nextSettings,
      buildDefaultImportSystemPrompt(pack),
    );
  }

  await withDbRetry(() =>
    prisma.shopConfig.upsert({
      where: { shopId },
      create: {
        shopId,
        settings: nextSettings as Prisma.InputJsonValue,
      },
      update: {
        settings: nextSettings as Prisma.InputJsonValue,
      },
    }),
  );

  const shopRecord = await withDbRetry(() =>
    prisma.shop.findUnique({
      where: { id: shopId },
    }),
  );
  if (shopRecord) {
    await upsertStoreProfileForShop({
      shopId,
      shopDomain: shopRecord.shopDomain,
      definitions,
      shop: shopRecord,
      systemPrompt:
        readImportSystemPromptFromSettings(nextSettings as Prisma.JsonValue) ??
        undefined,
    });
  }

  return pack;
}

export function readStoredImportPromptPack(
  settings: Prisma.JsonValue | null | undefined,
): ImportPromptPack | null {
  return readImportPromptPackFromSettings(readSettingsRecord(settings));
}

export function promptPackNeedsRefresh(
  definitions: MetafieldDefinitionNode[],
  stored: ImportPromptPack | null,
): boolean {
  if (!stored) {
    return true;
  }
  const current = buildImportPromptPack(definitions);
  return current.version !== stored.version;
}

export async function ensureImportPromptPack(
  shopId: string,
  definitions: MetafieldDefinitionNode[],
  stored: ImportPromptPack | null,
): Promise<ImportPromptPack> {
  if (!promptPackNeedsRefresh(definitions, stored)) {
    return stored as ImportPromptPack;
  }
  return upsertImportPromptPackForShop(shopId, definitions);
}
