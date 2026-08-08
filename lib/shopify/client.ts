import type { Shop } from "@/generated/prisma/client";
import { getShopAccessToken } from "@/lib/db/shops";

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function shopifyGraphql<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const apiVersion = process.env.SHOPIFY_API_VERSION ?? "2026-07";
  const response = await fetch(
    `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Shopify GraphQL request failed (${response.status}) for ${shopDomain}`,
    );
  }

  const payload = (await response.json()) as GraphQLResponse<T>;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  if (!payload.data) {
    throw new Error(`Shopify GraphQL returned no data for ${shopDomain}`);
  }

  return payload.data;
}

export async function shopifyGraphqlForShop<T>(
  shop: Shop,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  return shopifyGraphql<T>(
    shop.shopDomain,
    getShopAccessToken(shop),
    query,
    variables,
  );
}
