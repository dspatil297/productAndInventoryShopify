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

    if (data.metafieldsSet.userErrors.length === 0) {
      saved += data.metafieldsSet.metafields?.length ?? 0;
      continue;
    }

    // metafieldsSet is atomic per batch: if 1 fails, retry individually so valid ones still save
    if (batch.length > 1) {
      for (const single of batch) {
        const singleData =
          await shopifyGraphqlForShop<MetafieldsSetGraphqlResponse>(
            shop,
            METAFIELDS_SET_MUTATION,
            {
              metafields: [
                {
                  ownerId: single.ownerId,
                  namespace: single.namespace,
                  key: single.key,
                  type: single.type,
                  value: single.value,
                },
              ],
            },
          );
        if (singleData.metafieldsSet.userErrors.length === 0) {
          saved += singleData.metafieldsSet.metafields?.length ?? 0;
        } else {
          for (const userError of singleData.metafieldsSet.userErrors) {
            errors.push({
              ownerId: single.ownerId,
              namespace: single.namespace,
              key: single.key,
              message: userError.message,
            });
          }
        }
      }
      continue;
    }

    for (const userError of data.metafieldsSet.userErrors) {
      errors.push({
        ownerId: batch[0]?.ownerId ?? "unknown",
        namespace: batch[0]?.namespace ?? "",
        key: batch[0]?.key ?? "",
        message: userError.message,
      });
    }
    saved += data.metafieldsSet.metafields?.length ?? 0;
  }

  return { saved, errors };
}
