import Link from "next/link";
import { agencyButtonClass } from "@/components/agency/styles";

interface AgencyNavProps {
  userName: string;
}

const NAV_ITEMS = [
  { href: "/agency/dashboard", label: "Dashboard" },
  { href: "/agency/stores", label: "Stores" },
  { href: "/agency/connect", label: "Connect store" },
];

export const AgencyNav = ({ userName }: AgencyNavProps) => {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/agency/dashboard" className="font-semibold">
            Agency Ops
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{userName}</span>
          <form action="/api/agency/logout" method="POST">
            <button type="submit" className={agencyButtonClass.outline}>
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
};
