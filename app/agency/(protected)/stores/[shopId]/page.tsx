import Link from "next/link";
import { notFound } from "next/navigation";
import { StoreSettingsForm } from "@/components/agency/StoreSettingsForm";
import { toAgencyStoreSummary } from "@/lib/agency/stores";
import { getShopWithConfig } from "@/lib/db/shops";

interface StoreDetailPageProps {
  params: Promise<{ shopId: string }>;
  searchParams: Promise<{ saved?: string }>;
}

export default async function StoreDetailPage({
  params,
  searchParams,
}: StoreDetailPageProps) {
  const { shopId } = await params;
  const query = await searchParams;
  const shop = await getShopWithConfig(shopId);
  if (!shop) {
    notFound();
  }

  const store = toAgencyStoreSummary(shop);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/agency/stores" className="text-sm underline">
          ← Back to stores
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">{store.shopName}</h1>
        <p className="mt-2 text-muted-foreground">{store.shopDomain}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard label="Status" value={store.isActive ? "Active" : "Inactive"} />
        <InfoCard label="Plan" value={store.planName ?? "—"} />
        <InfoCard label="Currency" value={store.currencyCode} />
        <InfoCard label="Products" value={String(store.productCount ?? "—")} />
        <InfoCard label="Locations" value={String(store.locationCount)} />
        <InfoCard
          label="Metafield defs"
          value={String(store.metafieldDefCount)}
        />
        <InfoCard
          label="Installed"
          value={new Date(store.installedAt).toLocaleDateString()}
        />
        <InfoCard
          label="Last sync"
          value={
            store.lastSyncedAt
              ? new Date(store.lastSyncedAt).toLocaleString()
              : "—"
          }
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Management</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage this store&apos;s catalog and inventory.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link
            href={`/agency/stores/${shopId}/products`}
            className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
          >
            Products
          </Link>
          <Link
            href={`/agency/stores/${shopId}/metafields`}
            className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
          >
            Metafields
          </Link>
          <Link
            href={`/agency/stores/${shopId}/inventory`}
            className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
          >
            Inventory
          </Link>
        </div>
      </section>

      <StoreSettingsForm store={store} saved={query.saved === "1"} />
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
