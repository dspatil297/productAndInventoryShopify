import type { Prisma } from "@/generated/prisma/client";
import type { Shop } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { upsertImportPromptPackForShop } from "@/lib/import/sync-prompt-pack";
import { getShopAccessToken } from "@/lib/db/shops";
import { shopifyGraphql } from "@/lib/shopify/client";
import { METAFIELD_DEFINITIONS_QUERY } from "@/lib/shopify/queries";
import type { MetafieldDefinitionNode } from "@/types/shopify";

const PAGE_SIZE = 50;

interface MetafieldDefinitionsResponse {
  metafieldDefinitions: {
    edges: Array<{ node: MetafieldDefinitionNode }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

async function fetchAllMetafieldDefinitions(
  shopDomain: string,
  accessToken: string,
): Promise<MetafieldDefinitionNode[]> {
  const definitions: MetafieldDefinitionNode[] = [];
  let after: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data: MetafieldDefinitionsResponse = await shopifyGraphql<MetafieldDefinitionsResponse>(
      shopDomain,
      accessToken,
      METAFIELD_DEFINITIONS_QUERY,
      { first: PAGE_SIZE, after },
    );

    for (const edge of data.metafieldDefinitions.edges) {
      definitions.push(edge.node);
    }

    hasNextPage = data.metafieldDefinitions.pageInfo.hasNextPage;
    after = data.metafieldDefinitions.pageInfo.endCursor;
  }

  return definitions;
}

export async function refreshMetafieldDefinitionsForShop(
  shop: Shop,
): Promise<MetafieldDefinitionNode[]> {
  const definitions = await fetchAllMetafieldDefinitions(
    shop.shopDomain,
    getShopAccessToken(shop),
  );

  await prisma.shopConfig.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      metafieldDefinitions: definitions as unknown as Prisma.InputJsonValue,
      lastSyncedAt: new Date(),
    },
    update: {
      metafieldDefinitions: definitions as unknown as Prisma.InputJsonValue,
      lastSyncedAt: new Date(),
    },
  });

  await upsertImportPromptPackForShop(shop.id, definitions);

  return definitions;
}
