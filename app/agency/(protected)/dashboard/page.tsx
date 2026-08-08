import Link from "next/link";
import { InstallLinkForm } from "@/components/agency/InstallLinkForm";
import {
  sumProductCounts,
  toAgencyStoreSummary,
} from "@/lib/agency/stores";
import { listShopsWithConfig } from "@/lib/db/shops";

export default async function AgencyDashboardPage() {
  const shops = await listShopsWithConfig();
  const stores = shops.map(toAgencyStoreSummary);
  const activeStores = stores.filter((store) => store.isActive);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Overview of all connected client stores.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total stores" value={String(stores.length)} />
        <StatCard label="Active" value={String(activeStores.length)} />
        <StatCard
          label="Inactive"
          value={String(stores.length - activeStores.length)}
        />
        <StatCard
          label="Total products"
          value={String(sumProductCounts(stores))}
        />
      </div>

      <InstallLinkForm />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent stores</h2>
          <Link href="/agency/stores" className="text-sm underline">
            View all
          </Link>
        </div>
        <div className="grid gap-3">
          {stores.slice(0, 5).map((store) => (
            <Link
              key={store.id}
              href={`/agency/stores/${store.id}`}
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">{store.shopName}</div>
                  <div className="text-sm text-muted-foreground">
                    {store.shopDomain}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div>{store.isActive ? "Active" : "Inactive"}</div>
                  <div className="text-muted-foreground">
                    {store.productCount ?? 0} products
                  </div>
                </div>
              </div>
            </Link>
          ))}
          {stores.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No stores yet.{" "}
              <Link href="/agency/connect" className="underline">
                Connect one
              </Link>
              .
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}
