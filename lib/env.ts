export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getHostNameFromRequest(request: Request): string | null {
  const raw =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!raw) {
    return null;
  }
  const host = raw.split(",")[0]?.trim();
  if (!host) {
    return null;
  }
  return host.replace(/:\d+$/, "");
}

function parseEnvAppHost(): string | null {
  const raw = process.env.SHOPIFY_APP_URL?.trim().replace(/^["']|["']$/g, "");
  if (!raw) {
    return null;
  }
  const url = raw.startsWith("http") ? raw : `https://${raw}`;
  return new URL(url).host;
}

function isInternalDevHost(host: string): boolean {
  const lower = host.toLowerCase();
  return (
    lower === "localhost" ||
    lower.startsWith("localhost:") ||
    lower === "127.0.0.1" ||
    lower.startsWith("127.0.0.1:") ||
    /^192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(lower)
  );
}

/** Dev: tunnel/public host from request, else SHOPIFY_APP_URL (never localhost for OAuth). Prod: SHOPIFY_APP_URL only. */
export function resolveShopifyHostName(request?: Request): string {
  const envHost = parseEnvAppHost();

  if (process.env.NODE_ENV === "production") {
    if (!envHost) {
      throw new Error("SHOPIFY_APP_URL is required in production");
    }
    return envHost;
  }

  const requestHost = request ? getHostNameFromRequest(request) : null;

  if (requestHost && !isInternalDevHost(requestHost)) {
    return requestHost;
  }

  if (envHost) {
    return envHost;
  }

  if (requestHost) {
    return requestHost;
  }

  throw new Error(
    "Set SHOPIFY_APP_URL to your shopify app dev tunnel URL in .env.local",
  );
}

export function getOAuthCallbackUrl(request: Request): string {
  const hostName = resolveShopifyHostName(request);
  return `https://${hostName}/api/auth/callback`;
}

export function assertOAuthHostConfigured(request: Request): void {
  const hostName = resolveShopifyHostName(request);
  if (process.env.NODE_ENV !== "production" && isInternalDevHost(hostName)) {
    throw new Error(
      "OAuth redirect would use localhost. Set SHOPIFY_APP_URL in .env.local to the tunnel URL shown by shopify app dev, then restart.",
    );
  }
}

/** @deprecated use resolveShopifyHostName(request) */
export function getShopifyHostName(): string {
  return resolveShopifyHostName();
}

export function getShopifyScopes(): string[] {
  return requireEnv("SCOPES")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}
