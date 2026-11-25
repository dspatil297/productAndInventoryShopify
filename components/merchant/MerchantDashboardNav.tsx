"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Boxes,
  FileSpreadsheet,
  LogOut,
  Package,
  SlidersHorizontal,
} from "lucide-react";
import { merchantSwitchStoreAction } from "@/app/login/actions";

const MODULE_LINKS = [
  { href: "/merchant/products", label: "Products", icon: Package },
  { href: "/merchant/metafields", label: "Metafields", icon: SlidersHorizontal },
  { href: "/merchant/inventory", label: "Inventory", icon: Boxes },
  { href: "/merchant/import", label: "Import", icon: FileSpreadsheet },
] as const;

interface MerchantDashboardNavProps {
  shopName: string;
  showSwitchStore?: boolean;
}

export function MerchantDashboardNav({
  shopName,
  showSwitchStore = false,
}: MerchantDashboardNavProps) {
  const pathname = usePathname();
  const initial = shopName.trim().charAt(0).toUpperCase() || "S";

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-border bg-sidebar md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 md:block">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-xs">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Catalog Studio
            </p>
            <p className="truncate text-sm font-semibold text-foreground">
              {shopName}
            </p>
          </div>
        </div>
        {showSwitchStore ? (
          <form action={merchantSwitchStoreAction} className="md:mt-3">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
            >
              <ArrowLeftRight className="h-3 w-3" />
              Switch store
            </button>
          </form>
        ) : null}
      </div>

      <nav
        aria-label="Merchant tools"
        className="flex gap-1 overflow-x-auto px-3 py-2.5 md:flex-col md:overflow-visible md:py-4"
      >
        {MODULE_LINKS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              }`}
            >
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1.5 left-0 hidden w-0.5 rounded-full bg-primary md:block"
                />
              ) : null}
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="hidden border-t border-border p-3 md:mt-auto md:block">
        <form method="POST" action="/api/merchant/logout">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground cursor-pointer"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
