import type { Prisma, Shop } from "@/generated/prisma/client";
import { updateShopConfig } from "@/lib/db/shops";
import { prisma } from "@/lib/db/prisma";import { DEFAULT_IMPORT_POLICY } from "@/lib/import/spec/import-policy";
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
import type { MetafieldDefinitionNode } from "@/types/shopify";

const PROFILE_KEY = "importStoreProfile";

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
      discoverThemeMetafields(input.shop),
      sampleStoreProductMetafields(input.shop),
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

  const existing = await prisma.shopConfig.findUnique({
    where: { shopId: input.shopId },
    select: { settings: true },
  });
  const settings = readSettingsRecord(existing?.settings);
  const prior = readStoreProfile(settings as Prisma.JsonValue);

  const profile: StoreProfile = {
    schema,
    system_prompt: input.systemPrompt ?? prior?.system_prompt ?? "",
    mapping_config: input.mappingConfig ?? prior?.mapping_config ?? emptyMappingConfig(),
    import_policy: input.importPolicy ?? prior?.import_policy ?? DEFAULT_IMPORT_POLICY,
    updated_at: new Date().toISOString(),
  };

  if (!profile.system_prompt) {
    const lines = schema.metafields.map(
      (field) =>
        `- ${field.namespace}.${field.key} (${field.shopify_type}): ${field.name}`,
    );
    profile.system_prompt = `You are a Shopify catalog mapping assistant.\n\nStore schema:\n${lines.join("\n")}`;
  }

  await updateShopConfig(input.shopId, {
    settings: { [PROFILE_KEY]: profile },
  });

  return profile;
}
