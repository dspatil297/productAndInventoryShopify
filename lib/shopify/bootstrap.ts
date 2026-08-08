import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { upsertShop } from "@/lib/db/shops";
import { upsertImportPromptPackForShop } from "@/lib/import/sync-prompt-pack";import { shopifyGraphql } from "@/lib/shopify/client";
import {
  LOCATIONS_QUERY,
  METAFIELD_DEFINITIONS_QUERY,
  PRODUCTS_COUNT_QUERY,
  PRODUCT_TYPES_QUERY,
  SHOP_QUERY,
} from "@/lib/shopify/queries";
import type {
  BootstrapShopResult,
  MetafieldDefinitionNode,
  ShopInfo,
} from "@/types/shopify";

const PAGE_SIZE = 50;

interface MetafieldDefinitionsResponse {
  metafieldDefinitions: {
    edges: Array<{ node: MetafieldDefinitionNode }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

interface LocationsResponse {
  locations: {
    nodes: Array<{
      id: string;
      name: string;
      isActive: boolean;
      address: { city: string | null; country: string | null } | null;
    }>;
  };
}

interface ProductTypesResponse {
  products: {
    edges: Array<{ node: { productType: string | null } }>;
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

async function fetchProductTypes(
  shopDomain: string,
  accessToken: string,
): Promise<string[]> {
  const productTypes = new Set<string>();
  let after: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data: ProductTypesResponse = await shopifyGraphql<ProductTypesResponse>(
      shopDomain,
      accessToken,
      PRODUCT_TYPES_QUERY,
      { first: PAGE_SIZE, after },
    );

    for (const edge of data.products.edges) {
      const productType = edge.node.productType?.trim();
      if (productType) {
        productTypes.add(productType);
      }
    }

    hasNextPage = data.products.pageInfo.hasNextPage;
    after = data.products.pageInfo.endCursor;
  }

  return [...productTypes].sort();
}

export async function bootstrapShop(
  shopDomain: string,
  accessToken: string,
  scope?: string,
): Promise<BootstrapShopResult> {
  const shopData = await shopifyGraphql<{ shop: ShopInfo }>(
    shopDomain,
    accessToken,
    SHOP_QUERY,
  );

  const shopInfo = shopData.shop;
  const myshopifyDomain = shopInfo.myshopifyDomain ?? shopDomain;

  const shop = await upsertShop({
    shopDomain: myshopifyDomain,
    shopName: shopInfo.name,
    shopEmail: shopInfo.email,
    shopifyShopId: shopInfo.id,
    planName: shopInfo.plan?.displayName ?? null,
    accessToken,
    scope,
    currencyCode: shopInfo.currencyCode,
    timezone: shopInfo.timezoneAbbreviation,
  });

  const [metafieldDefinitions, locationsData, productTypes, productsCountData] =
    await Promise.all([
      fetchAllMetafieldDefinitions(myshopifyDomain, accessToken),
      shopifyGraphql<LocationsResponse>(
        myshopifyDomain,
        accessToken,
        LOCATIONS_QUERY,
        { first: 50 },
      ),
      fetchProductTypes(myshopifyDomain, accessToken),
      shopifyGraphql<{ productsCount: { count: number } }>(
        myshopifyDomain,
        accessToken,
        PRODUCTS_COUNT_QUERY,
      ),
    ]);

  const productCount = productsCountData.productsCount.count;
  const existingConfig = await prisma.shopConfig.findUnique({
    where: { shopId: shop.id },
  });
  const existingSettings =
    typeof existingConfig?.settings === "object" &&
    existingConfig.settings !== null
      ? (existingConfig.settings as Record<string, unknown>)
      : {};

  const settingsPayload = {
    ...existingSettings,
    productCount,
  } as Prisma.InputJsonValue;

  const config = await prisma.shopConfig.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      metafieldDefinitions: metafieldDefinitions as unknown as Prisma.InputJsonValue,
      locations: locationsData.locations.nodes as unknown as Prisma.InputJsonValue,
      productTypes: productTypes as unknown as Prisma.InputJsonValue,
      settings: settingsPayload,
      lastSyncedAt: new Date(),
    },
    update: {
      metafieldDefinitions: metafieldDefinitions as unknown as Prisma.InputJsonValue,
      locations: locationsData.locations.nodes as unknown as Prisma.InputJsonValue,
      productTypes: productTypes as unknown as Prisma.InputJsonValue,
      settings: settingsPayload,
      lastSyncedAt: new Date(),
    },
  });

  await upsertImportPromptPackForShop(shop.id, metafieldDefinitions);

  return { shop, config };
}
