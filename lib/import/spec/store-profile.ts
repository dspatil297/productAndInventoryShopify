import type { Prisma, Shop } from "@/generated/prisma/client";
import { prisma, withDbRetry } from "@/lib/db/prisma";
import { updateShopConfig } from "@/lib/db/shops";
import { buildImportPromptPack } from "@/lib/import/prompt-pack";
import { DEFAULT_IMPORT_POLICY } from "@/lib/import/spec/import-policy";
import { buildStoreSchema, type ThemeMetafieldUsage } from "@/lib/import/spec/schema-discovery";
import {
  discoverThemeMetafields,
  sampleStoreProductMetafields,
} from "@/lib/import/spec/theme-scan";
import type {
  ImportPolicy,
  MappingConfig,
  StoreProfile,
} from "@/lib/import/spec/types";
import {
  buildDefaultImportSystemPrompt,
  isLegacySystemPrompt,
  readImportSystemPromptFromSettings,
} from "@/lib/import/system-prompt";
import type { MetafieldDefinitionNode } from "@/types/shopify";

const PROFILE_KEY = "importStoreProfile";
const ENRICHMENT_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Theme enrichment timed out")), ms),
    ),
  ]);
}

function readSettingsRecord(
  settings: Prisma.JsonValue | null | undefined,
): Record<string, unknown> {
  if (typeof settings === "object" && settings !== null && !Array.isArray(settings)) {
    return settings as Record<string, unknown>;
  }
  return {};
}

export function readStoreProfile(
  settings: Prisma.JsonValue | null | undefined,
): StoreProfile | null {
  const record = readSettingsRecord(settings)[PROFILE_KEY];
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return null;
  }
  return record as unknown as StoreProfile;
}

function emptyMappingConfig(): MappingConfig {
  return {
    excel: { header_row: 1 },
    column_map: {},
    handle_overrides: {},
    template_map: {},
    handle_strategy: { primary: "slugify", source_column: "", overrides: {} },
    notes: [],
  };
}

export async function upsertStoreProfileForShop(input: {
  shopId: string;
  shopDomain: string;
  definitions: MetafieldDefinitionNode[];
  productTemplates?: string[];
  systemPrompt?: string;
  importPolicy?: ImportPolicy;
  mappingConfig?: MappingConfig;
  shop?: Shop;
}): Promise<StoreProfile> {
  let themeMetafields: Map<string, ThemeMetafieldUsage> | undefined;
  let sampleValues: Map<string, string[]> | undefined;
  if (input.shop) {
    const [themeRes, sampleRes] = await Promise.allSettled([
      withTimeout(discoverThemeMetafields(input.shop), ENRICHMENT_TIMEOUT_MS),
      withTimeout(sampleStoreProductMetafields(input.shop), ENRICHMENT_TIMEOUT_MS),
    ]);
    themeMetafields = themeRes.status === "fulfilled" ? themeRes.value : undefined;
    sampleValues = sampleRes.status === "fulfilled" ? sampleRes.value : undefined;
  }

  const schema = buildStoreSchema({
    shop: input.shopDomain,
    definitions: input.definitions,
    productTemplates: input.productTemplates,
    themeMetafields,
    sampleValues,
  });

  const existing = await withDbRetry(() =>
    prisma.shopConfig.findUnique({
      where: { shopId: input.shopId },
      select: { settings: true },
    }),
  );
  const settings = readSettingsRecord(existing?.settings);
  const prior = readStoreProfile(settings as Prisma.JsonValue);
  const storedPrompt = readImportSystemPromptFromSettings(settings as Prisma.JsonValue);
  const candidatePrompt =
    input.systemPrompt ??
    (prior?.system_prompt && !isLegacySystemPrompt(prior.system_prompt)
      ? prior.system_prompt
      : undefined) ??
    (storedPrompt && !isLegacySystemPrompt(storedPrompt)
      ? storedPrompt
      : undefined);

  const importPolicy =
    input.importPolicy ?? prior?.import_policy ?? DEFAULT_IMPORT_POLICY;

  const profile: StoreProfile = {
    schema,
    system_prompt:
      candidatePrompt ||
      buildDefaultImportSystemPrompt(
        buildImportPromptPack(input.definitions),
        schema,
        importPolicy,
      ),
    mapping_config: input.mappingConfig ?? prior?.mapping_config ?? emptyMappingConfig(),
    import_policy: importPolicy,
    updated_at: new Date().toISOString(),
  };

  await updateShopConfig(input.shopId, {
    settings: {
      [PROFILE_KEY]: profile,
      ...(input.systemPrompt || !storedPrompt || isLegacySystemPrompt(storedPrompt)
        ? { importSystemPrompt: profile.system_prompt }
        : {}),
    },
  });

  return profile;
}
