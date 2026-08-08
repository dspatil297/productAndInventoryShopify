"use client";

import { AppProvider } from "@shopify/polaris";
import en from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";

interface MerchantProvidersProps {
  children: React.ReactNode;
}

export function MerchantProviders({ children }: MerchantProvidersProps) {
  return <AppProvider i18n={en}>{children}</AppProvider>;
}
