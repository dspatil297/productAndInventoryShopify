export function normalizeShopDomain(input: string): string | null {
  let value = input
    .trim()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    ?.split("?")[0]
    ?.replace(/\/$/, "") ?? "";
  if (!value) {
    return null;
  }

  if (!value.includes(".")) {
    value = `${value}.myshopify.com`;
  }

  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(value)) {
    return null;
  }

  return value.toLowerCase();
}

export function buildInstallUrl(appBaseUrl: string, shopInput: string): string | null {
  const shopDomain = normalizeShopDomain(shopInput);
  if (!shopDomain) {
    return null;
  }

  const base = appBaseUrl.replace(/\/$/, "");
  return `${base}/api/auth?shop=${encodeURIComponent(shopDomain)}`;
}
