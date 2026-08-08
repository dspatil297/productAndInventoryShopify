"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ImportJobAutoRefreshProps {
  active: boolean;
  intervalMs?: number;
}

export function ImportJobAutoRefresh({
  active,
  intervalMs = 2500,
}: ImportJobAutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, router]);

  return null;
}
