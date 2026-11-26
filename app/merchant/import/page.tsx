import { ProductImportPanel } from "@/components/merchant/ProductImportPanel";
import { getShopWithConfig } from "@/lib/db/shops";
import {
  PRODUCT_IMPORT_BASE_HEADER_COUNT,
  productImportHeaders,
} from "@/lib/csv/productImport";
import { getExcelMapJob } from "@/lib/import/excel-map-jobs";
import { readStoreProfile } from "@/lib/import/spec/store-profile";
import {
  buildDefaultImportSystemPrompt,
  isLegacySystemPrompt,
  readImportSystemPromptFromSettings,
} from "@/lib/import/system-prompt";
import {
  ensureImportPromptPack,
  readStoredImportPromptPack,
} from "@/lib/import/sync-prompt-pack";
import { readMetafieldDefinitionsFromConfig } from "@/lib/metafields/config";
import { requireMerchantPortalShop } from "@/lib/merchant/auth";

interface MerchantImportPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function MerchantImportPage({
  searchParams,
}: MerchantImportPageProps) {
  const query = await searchParams;
  const shop = await requireMerchantPortalShop();
  const shopWithConfig = await getShopWithConfig(shop.id);
  const definitions = readMetafieldDefinitionsFromConfig(shopWithConfig?.config);
  const headers = productImportHeaders(definitions);
  const metafieldColumnCount = Math.max(
    0,
    headers.length - PRODUCT_IMPORT_BASE_HEADER_COUNT,
  );

  let promptPack = readStoredImportPromptPack(shopWithConfig?.config?.settings);
  if (definitions.length > 0) {
    promptPack = await ensureImportPromptPack(shop.id, definitions, promptPack);
  }

  const storeProfile = readStoreProfile(shopWithConfig?.config?.settings);
  let systemPrompt: string | undefined = storeProfile?.system_prompt;
  if (isLegacySystemPrompt(systemPrompt)) {
    const savedPrompt = readImportSystemPromptFromSettings(
      shopWithConfig?.config?.settings,
    );
    systemPrompt = isLegacySystemPrompt(savedPrompt)
      ? undefined
      : (savedPrompt ?? undefined);
  }
  if (!systemPrompt && promptPack) {
    systemPrompt = buildDefaultImportSystemPrompt(
      promptPack,
      storeProfile?.schema,
      storeProfile?.import_policy,
    );
  }
  if (!systemPrompt) {
    systemPrompt = "Refresh import columns to generate the system prompt.";
  }

  const jobId = firstParam(query.job) ?? null;
  const initialJob = jobId ? await getExcelMapJob(jobId, shop.id) : null;

  return (
    <ProductImportPanel
      shopId={shop.id}
      shopName={shop.shopName}
      metafieldColumnCount={metafieldColumnCount}
      definitions={definitions}
      systemPrompt={systemPrompt}
      promptPackVersion={promptPack?.version ?? null}
      promptPackBuiltAt={promptPack?.builtAt ?? null}
      initialTab={firstParam(query.tab) === "ai" ? "ai" : "csv"}
      jobId={jobId}
      initialJob={initialJob}
      flash={{
        saved: firstParam(query.saved),
        error: firstParam(query.error),
        mapped: firstParam(query.mapped),
        prepared: firstParam(query.prepared),
        defs: firstParam(query.defs),
        processing: firstParam(query.processing),
        promptSaved: firstParam(query.promptSaved),
        promptRegenerated: firstParam(query.promptRegenerated),
      }}
    />
  );
}
