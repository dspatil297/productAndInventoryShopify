const REQUIRED_THEME_SYNC_SCOPES = ["read_themes"] as const;

export function parseShopScopes(scope: string | null | undefined): Set<string> {
  if (!scope?.trim()) {
    return new Set();
  }
  return new Set(
    scope
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

export function shopHasScope(
  scope: string | null | undefined,
  required: string,
): boolean {
  return parseShopScopes(scope).has(required);
}

export function missingThemeSyncScopes(
  scope: string | null | undefined,
): string[] {
  return REQUIRED_THEME_SYNC_SCOPES.filter(
    (required) => !shopHasScope(scope, required),
  );
}

export function themeSyncScopeError(
  scope: string | null | undefined,
): string | null {
  const missing = missingThemeSyncScopes(scope);
  if (missing.length === 0) {
    return null;
  }
  return `Shop token missing scope: ${missing.join(", ")}. Press P in shopify app dev (or reinstall app) to approve updated scopes, then Sync templates again.`;
}
