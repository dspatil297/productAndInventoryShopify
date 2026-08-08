"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    mfBootMetafieldEditors?: () => void;
  }
}

/** Re-boot vanilla metafield widgets after React hydration (tunnel-safe). */
export function MetafieldEditorBoot() {
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 10;

    const boot = () => {
      window.mfBootMetafieldEditors?.();
      attempts += 1;
      if (attempts < maxAttempts) {
        window.setTimeout(boot, 150);
      }
    };

    boot();
    return undefined;
  }, []);

  return null;
}
