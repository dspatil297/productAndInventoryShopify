export function buildPortalBouncePath(embedded: {
  shop: string;
  host: string;
}): string {
  const params = new URLSearchParams({
    shop: embedded.shop,
    host: embedded.host,
    "shopify-reload": "/merchant/enter",
  });
  return `/app/session-token-bounce?${params.toString()}`;
}

export function buildPortalBounceHref(
  appBaseUrl: string,
  embedded: { shop: string; host: string },
): string {
  return new URL(buildPortalBouncePath(embedded), `${appBaseUrl}/`).toString();
}
