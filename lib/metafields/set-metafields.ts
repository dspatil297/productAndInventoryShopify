import type { Shop } from "@/generated/prisma/client";
import { METAFIELD_BATCH_SIZE } from "@/lib/metafields/constants";
import type {
  MetafieldSaveResult,
  MetafieldUpdateInput,
} from "@/lib/metafields/types";
import {
  normalizeMetafieldValue,
  validateMetafieldValue,
} from "@/lib/metafields/validators";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import { METAFIELDS_SET_MUTATION } from "@/lib/shopify/mutations";

interface MetafieldsSetGraphqlResponse {
  metafieldsSet: {
    metafields: Array<{
      id: string;
      namespace: string;
      key: string;
      value: string;
    }> | null;
    userErrors: Array<{
      field: string[] | null;
      message: string;
    }>;
  };
}

function chunkUpdates(updates: MetafieldUpdateInput[]): MetafieldUpdateInput[][] {
  const chunks: MetafieldUpdateInput[][] = [];
  for (let index = 0; index < updates.length; index += METAFIELD_BATCH_SIZE) {
    chunks.push(updates.slice(index, index + METAFIELD_BATCH_SIZE));
  }
  return chunks;
}

export async function setShopMetafields(
  shop: Shop,
  updates: MetafieldUpdateInput[],
): Promise<MetafieldSaveResult> {
  const errors: MetafieldSaveResult["errors"] = [];
  let saved = 0;

  const normalizedUpdates: MetafieldUpdateInput[] = [];
  for (const update of updates) {
    const value = normalizeMetafieldValue(update.type, update.value);
    if (!value) {
      continue;
    }
    const validation = validateMetafieldValue(update.type, value);
    if (!validation.ok) {
      errors.push({
        ownerId: update.ownerId,
        namespace: update.namespace,
        key: update.key,
        message: validation.message,
      });
      continue;
    }
    normalizedUpdates.push({ ...update, value });
  }

  for (const batch of chunkUpdates(normalizedUpdates)) {
    const data = await shopifyGraphqlForShop<MetafieldsSetGraphqlResponse>(
      shop,
      METAFIELDS_SET_MUTATION,
      {
        metafields: batch.map((update) => ({
          ownerId: update.ownerId,
          namespace: update.namespace,
          key: update.key,
          type: update.type,
          value: update.value,
        })),
      },
    );

    for (const userError of data.metafieldsSet.userErrors) {
      const field = userError.field?.join(".") ?? "metafields";
      const matchedUpdate = batch.find((update) =>
        field.includes(update.namespace) && field.includes(update.key),
      );

      errors.push({
        ownerId: matchedUpdate?.ownerId ?? batch[0]?.ownerId ?? "unknown",
        namespace: matchedUpdate?.namespace ?? batch[0]?.namespace ?? "",
        key: matchedUpdate?.key ?? batch[0]?.key ?? "",
        message: userError.message,
      });
    }

    saved += data.metafieldsSet.metafields?.length ?? 0;
  }

  return { saved, errors };
}
