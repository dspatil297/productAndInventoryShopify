import type { Metadata } from "next";
import { Suspense } from "react";
import { AppNav } from "@/components/merchant/AppNav";
import { MerchantProviders } from "@/components/merchant/MerchantProviders";

export const metadata: Metadata = {
  title: "Products & Inventory",
  description: "Merchant app home",
  other: {
    "shopify-api-key":
      process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ||
      process.env.SHOPIFY_API_KEY ||
      process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ||
      "",
      "a48902c859417cfa3b5aba419b49eb15",
  },
};

export default function MerchantAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
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
  );
}
