"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const MODULE_LINKS = [
  { href: "/app", label: "Home" },
  { href: "/app/settings", label: "Settings" },
] as const;

function withEmbeddedParams(path: string, searchParams: URLSearchParams): string {
  const params = new URLSearchParams();
  const shop = searchParams.get("shop");
  const host = searchParams.get("host");
  if (shop) {
    params.set("shop", shop);
  }
  if (host) {
    params.set("host", host);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function AppNav() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  return (
    <nav
      aria-label="App modules"
      className="mb-4 flex flex-wrap gap-2 border-b border-border pb-3"
    >
      {MODULE_LINKS.map((item) => {
        const href = withEmbeddedParams(item.href, searchParams);
        const isActive =
          item.href === "/app"
            ? pathname === "/app"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={href}
            className={`rounded-md px-3 py-1.5 text-sm ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card hover:bg-muted"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
