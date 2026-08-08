export interface EmbeddedAuthContext {
  shop?: string;
  host?: string;
  sessionToken?: string;
}

export async function resolveEmbeddedSessionToken(
  embedded?: EmbeddedAuthContext,
): Promise<string | undefined> {
  if (typeof window !== "undefined" && window.shopify?.idToken) {
    try {
      return await window.shopify.idToken();
    } catch {
      // ponytail: fall back to server-passed token or shop/host query auth
    }
  }

  return embedded?.sessionToken;
}

export function buildEmbeddedApiQuery(
  embedded?: EmbeddedAuthContext,
): string {
  const params = new URLSearchParams();
  if (embedded?.shop) {
    params.set("shop", embedded.shop);
  }
  if (embedded?.host) {
    params.set("host", embedded.host);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

async function shopApiFetch(
  path: string,
  embedded: EmbeddedAuthContext | undefined,
  init: RequestInit,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const token = await resolveEmbeddedSessionToken(embedded);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(`${path}${buildEmbeddedApiQuery(embedded)}`, {
    ...init,
    headers,
    credentials: "include",
  });
}

export async function postShopMetafields(
  shopId: string,
  updates: Array<{
    ownerId: string;
    namespace: string;
    key: string;
    type: string;
    value: string;
  }>,
  embedded?: EmbeddedAuthContext,
): Promise<{
  saved?: number;
  errors?: Array<{
    ownerId: string;
    namespace: string;
    key: string;
    message: string;
  }>;
  error?: string;
}> {
  const response = await shopApiFetch(
    `/api/shops/${shopId}/metafields`,
    embedded,
    {
      method: "POST",
      body: JSON.stringify({ updates }),
    },
  );

  const payload = (await response.json()) as {
    saved?: number;
    errors?: Array<{
      ownerId: string;
      namespace: string;
      key: string;
      message: string;
    }>;
    error?: string;
  };

  if (!response.ok) {
    return { saved: 0, errors: [], error: payload.error ?? "Save failed" };
  }

  return payload;
}

export async function refreshShopMetafieldDefinitions(
  shopId: string,
  embedded?: EmbeddedAuthContext,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const response = await shopApiFetch(
    `/api/shops/${shopId}/metafield-definitions`,
    embedded,
    { method: "POST" },
  );

  const payload = (await response.json()) as {
    definitions?: unknown[];
    error?: string;
  };

  if (!response.ok) {
    return { ok: false, error: payload.error ?? "Refresh failed" };
  }

  return { ok: true, count: payload.definitions?.length ?? 0 };
}

interface ShopifyGlobal {
  idToken?: () => Promise<string>;
}

declare global {
  interface Window {
    shopify?: ShopifyGlobal;
  }
}
