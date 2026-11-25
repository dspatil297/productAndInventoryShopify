"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

async function resolveBounceToken(
  idTokenFromUrl: string | null,
): Promise<{ token: string | null; diagnostic?: string }> {
  if (idTokenFromUrl) {
    return { token: idTokenFromUrl };
  }

  let lastErr = "";
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const shopify = (
      window as unknown as {
        shopify?: { idToken?: () => Promise<string> | string };
      }
    ).shopify;
    if (shopify?.idToken) {
      try {
        const idToken = shopify.idToken;
        const resolved =
          typeof idToken === "function" ? await idToken() : await idToken;
        if (resolved && typeof resolved === "string" && resolved.length > 0) {
          return { token: resolved };
        }
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const hasShopify =
    typeof (window as unknown as { shopify?: unknown }).shopify !== "undefined";
  const metaApiKey = document
    .querySelector('meta[name="shopify-api-key"]')
    ?.getAttribute("content");

  return {
    token: null,
    diagnostic: `AppBridge: ${hasShopify ? "loaded" : "not loaded"}, apiKey: ${metaApiKey ? metaApiKey.slice(0, 6) + "..." : "missing"}${lastErr ? `, err: ${lastErr}` : ""}`,
  };
}

function navigateToMerchantPortal(
  enterUrl: string,
  isEmbeddedApp: boolean,
): void {
  if (isEmbeddedApp) {
    window.location.replace(enterUrl);
    return;
  }

  const topWindow = window.top;
  if (topWindow && topWindow !== window.self) {
    topWindow.location.href = enterUrl;
    return;
  }

  window.location.replace(enterUrl);
}

function isTopLevelOutsideAdmin(): boolean {
  try {
    return window.top === window.self;
  } catch {
    return false;
  }
}

function SessionTokenBounceInner() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function bounce() {
      const reload = searchParams.get("shopify-reload");
      if (!reload) {
        setError("Missing redirect target.");
        return;
      }

      // Outside Admin iframe App Bridge cannot mint tokens — send to login
      if (isTopLevelOutsideAdmin() && reload.startsWith("/app")) {
        window.location.replace("/login?error=sign_in_required");
        return;
      }

      let token = searchParams.get("id_token");
      if (!token) {
        const result = await resolveBounceToken(null);
        token = result.token;
        if (!token) {
          setError(
            `Could not get session token (${result.diagnostic ?? "timeout"}). Reopen the app from Shopify Admin.`,
          );
          return;
        }
      }

      const target = new URL(reload, window.location.origin);
      target.searchParams.set("id_token", token);

      const shop = searchParams.get("shop");
      const host = searchParams.get("host");
      if (shop) {
        target.searchParams.set("shop", shop);
      }
      if (host) {
        target.searchParams.set("host", host);
      }

      const isEmbedded = reload.startsWith("/app");
      navigateToMerchantPortal(target.toString(), isEmbedded);
    }

    void bounce();
  }, [searchParams]);

  if (error) {
    return (
      <div className="space-y-3 p-8 text-sm">
        <p className="text-destructive font-medium">{error}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Retry
          </button>
          <a
            className="text-xs text-muted-foreground underline hover:text-foreground"
            href="/login"
            target="_blank"
            rel="noopener noreferrer"
          >
            Go to merchant login
          </a>
        </div>
      </div>
    );
  }

  return (
    <p className="p-8 text-sm text-muted-foreground">
      Opening merchant dashboard…
    </p>
  );
}

export default function SessionTokenBouncePage() {
  return (
    <Suspense
      fallback={
        <p className="p-8 text-sm text-muted-foreground">
          Opening merchant dashboard…
        </p>
      }
    >
      <SessionTokenBounceInner />
    </Suspense>
  );
}
