import "@shopify/shopify-api/adapters/web-api";
import {
  ApiVersion,
  LogSeverity,
  type Shopify,
  shopifyApi,
} from "@shopify/shopify-api";
import { getShopifyScopes, requireEnv, resolveShopifyHostName } from "@/lib/env";
import { prismaSessionStorage } from "@/lib/shopify/session-storage";

const apiVersion = (process.env.SHOPIFY_API_VERSION ??
  "2026-07") as ApiVersion;

const clientCache = new Map<string, Shopify>();

function createShopifyClient(hostName: string): Shopify {
  return shopifyApi({
    apiKey: requireEnv("SHOPIFY_API_KEY"),
    apiSecretKey: requireEnv("SHOPIFY_API_SECRET"),
    scopes: getShopifyScopes(),
    hostName,
    hostScheme: "https",
    apiVersion,
    isEmbeddedApp: true,
    sessionStorage: prismaSessionStorage,
    logger: {
      level:
        process.env.NODE_ENV === "development"
          ? LogSeverity.Info
          : LogSeverity.Error,
    },
  });
}

export function getShopify(request?: Request): Shopify {
  const hostName = resolveShopifyHostName(request);
  const cached = clientCache.get(hostName);
  if (cached) {
    return cached;
  }
  const client = createShopifyClient(hostName);
  clientCache.set(hostName, client);
  return client;
}
