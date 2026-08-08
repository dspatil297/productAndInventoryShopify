export interface EmbeddedAuthContext {
  shop?: string;
  host?: string;
  sessionToken?: string;
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
