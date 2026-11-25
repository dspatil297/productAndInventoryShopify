"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function InstallExitIframeInner() {
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop") ?? "";
  const authUrl = shop ? `/api/auth?shop=${encodeURIComponent(shop)}` : "/login";

  useEffect(() => {
    if (!shop) {
      return;
    }
    window.open(authUrl, "_top");
  }, [authUrl, shop]);

  if (!shop) {
    return (
      <div className="p-8 text-sm">
        <p className="text-destructive">Missing shop parameter.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-8 text-sm">
      <p className="text-muted-foreground">
        Redirecting to Shopify to finish installing app for{" "}
        <span className="font-medium text-foreground">{shop}</span>…
      </p>
      <a
        href={authUrl}
        target="_top"
        rel="noopener noreferrer"
        className="inline-block rounded bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
      >
        Continue to install
      </a>
    </div>
  );
}

export default function InstallExitIframePage() {
  return (
    <Suspense
      fallback={
        <p className="p-8 text-sm text-muted-foreground">
          Preparing Shopify install…
        </p>
      }
    >
      <InstallExitIframeInner />
    </Suspense>
  );
}
