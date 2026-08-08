"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { merchantSwitchStoreAction } from "@/app/login/actions";

const MODULE_LINKS = [
  { href: "/merchant/products", label: "Products" },
  { href: "/merchant/metafields", label: "Metafields" },
  { href: "/merchant/inventory", label: "Inventory" },
  { href: "/merchant/import", label: "Import" },
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

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Merchant dashboard
        </p>
        <p className="mt-1 truncate font-semibold">{shopName}</p>
        {showSwitchStore ? (
          <form action={merchantSwitchStoreAction} className="mt-2">
            <button
              type="submit"
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              Switch store
            </button>
          </form>
        ) : null}
      </div>
      <nav aria-label="Merchant tools" className="flex flex-col gap-1 p-3">
        {MODULE_LINKS.map((item) => {
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-border p-3">
        <form method="POST" action="/api/merchant/logout">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
