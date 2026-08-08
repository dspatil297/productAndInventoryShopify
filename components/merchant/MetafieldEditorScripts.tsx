import Script from "next/script";
import { MetafieldEditorBoot } from "@/components/merchant/MetafieldEditorBoot";

/** Vanilla editors for metafield widgets (tunnel-safe). */
export function MetafieldEditorScripts() {
  return (
    <>
      <Script src="/tag-list.js" strategy="afterInteractive" />
      <Script src="/pair-list.js" strategy="afterInteractive" />
      <Script src="/json-object.js" strategy="afterInteractive" />
      <MetafieldEditorBoot />
    </>
  );
}
