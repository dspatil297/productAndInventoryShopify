import Link from "next/link";
import { agencyButtonClass } from "@/components/agency/styles";
import type { AgencyStoreSummary } from "@/lib/agency/stores";

interface StoreListProps {
  stores: AgencyStoreSummary[];
  synced?: boolean;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString();
}

export const StoreList = ({ stores, synced }: StoreListProps) => {
  if (stores.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <p className="text-muted-foreground">No stores connected yet.</p>
        <Link href="/agency/connect" className="mt-3 inline-block text-sm underline">
          Connect a store
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {synced ? (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
          Store config synced.
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-4 py-3 font-medium">Store</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Products</th>
              <th className="px-4 py-3 font-medium">Last sync</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => (
              <tr key={store.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{store.shopName}</div>
                  <div className="text-xs text-muted-foreground">
                    {store.shopDomain} · {store.currencyCode}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      store.isActive
                        ? "text-emerald-600"
                        : "text-muted-foreground"
                    }
                  >
                    {store.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">{store.planName ?? "—"}</td>
                <td className="px-4 py-3">{store.productCount ?? "—"}</td>
                <td className="px-4 py-3">{formatDate(store.lastSyncedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/agency/stores/${store.id}`}
                      className={agencyButtonClass.outline}
                    >
                      Open
                    </Link>
                    {store.isActive ? (
                      <form
                        action={`/api/agency/stores/${store.id}/sync`}
                        method="POST"
                      >
                        <button type="submit" className={agencyButtonClass.outline}>
                          Sync
                        </button>
                      </form>
                    ) : null}
                    {store.isActive ? (
                      <form
                        action={`/api/agency/stores/${store.id}/disconnect`}
                        method="POST"
                      >
                        <button type="submit" className={agencyButtonClass.destructive}>
                          Disconnect
                        </button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
