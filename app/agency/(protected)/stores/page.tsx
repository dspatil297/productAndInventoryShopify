import { StoreList } from "@/components/agency/StoreList";
import { InstallLinkForm } from "@/components/agency/InstallLinkForm";
import { toAgencyStoreSummary } from "@/lib/agency/stores";
import { listShopsWithConfig } from "@/lib/db/shops";

interface AgencyStoresPageProps {
  searchParams: Promise<{ synced?: string; disconnected?: string }>;
}

export default async function AgencyStoresPage({
  searchParams,
}: AgencyStoresPageProps) {
  const shops = await listShopsWithConfig();
  const stores = shops.map(toAgencyStoreSummary);
  const params = await searchParams;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Stores</h1>
        <p className="mt-2 text-muted-foreground">
          All client stores that installed the app.
        </p>
      </div>

      {params.disconnected ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">Store disconnected.</p>
      ) : null}

      <InstallLinkForm />
      <StoreList stores={stores} synced={params.synced === "1"} />
    </div>
  );
}
