export interface ShopInfo {
  id: string;
  name: string;
  email: string | null;
  myshopifyDomain: string | null;
  currencyCode: string;
  timezoneAbbreviation: string;
  plan: { displayName: string } | null;
  primaryDomain: { url: string } | null;
}

export interface MetafieldDefinitionNode {
  id: string;
  name: string;
  namespace: string;
  key: string;
  type: { name: string };
  description: string | null;
  validations: Array<{ name: string; value: string | null }>;
}

export interface BootstrapShopResult {
  shop: {
    id: string;
    shopDomain: string;
    shopName: string;
  };
  config: {
    id: string;
    lastSyncedAt: Date | null;
  };
}
