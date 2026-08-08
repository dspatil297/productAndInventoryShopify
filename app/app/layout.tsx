import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";
import { AppNav } from "@/components/merchant/AppNav";
import { MerchantProviders } from "@/components/merchant/MerchantProviders";
import { requireEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Products & Inventory",
  description: "Merchant app home",
};

export default function MerchantAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const apiKey = requireEnv("SHOPIFY_API_KEY");

  return (
    <>
      <head>
        <meta name="shopify-api-key" content={apiKey} />
      </head>
      <Script
        src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
        strategy="beforeInteractive"
      />
      <MerchantProviders>
        <div className="p-4 sm:p-6">
          <Suspense
            fallback={
              <nav className="mb-4 flex flex-wrap gap-2 border-b border-border pb-3">
                {["Home", "Settings"].map(
                  (label) => (
                    <span
                      key={label}
                      className="rounded-md border border-border px-3 py-1.5 text-sm opacity-50"
                    >
                      {label}
                    </span>
                  ),
                )}
              </nav>
            }
          >
            <AppNav />
          </Suspense>
          {children}
        </div>
      </MerchantProviders>
    </>
  );
}
