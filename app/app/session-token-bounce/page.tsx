"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

async function resolveBounceToken(
  idTokenFromUrl: string | null,
): Promise<string | null> {
  if (idTokenFromUrl) {
    return idTokenFromUrl;
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const shopify = window.shopify;
    if (shopify?.idToken) {
      try {
        const idToken = shopify.idToken;
        return typeof idToken === "function" ? await idToken() : await idToken;
      } catch {
        break;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return null;
}

function navigateToMerchantPortal(enterUrl: string): void {
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
        token = await resolveBounceToken(null);
      }

      if (!token) {
        setError("Could not get session token. Reopen the app from Shopify Admin.");
        return;
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

      navigateToMerchantPortal(target.toString());
    }

    void bounce();
  }, [searchParams]);

  if (error) {
    return (
      <div className="space-y-3 p-8 text-sm">
        <p className="text-destructive">{error}</p>
        <p>
          <a className="underline" href="/login">
            Go to merchant login
          </a>
        </p>
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
