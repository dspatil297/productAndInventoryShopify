import { agencyButtonClass } from "@/components/agency/styles";
import { updateStoreSettingsAction } from "@/app/agency/(protected)/stores/[shopId]/actions";
import type { AgencyStoreSummary } from "@/lib/agency/stores";

interface StoreSettingsFormProps {
  store: AgencyStoreSummary;
  saved?: boolean;
}

export const StoreSettingsForm = ({ store, saved }: StoreSettingsFormProps) => {
  return (
    <form
      action={updateStoreSettingsAction}
      className="space-y-4 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-lg font-semibold">Store settings</h2>
      {saved ? (
        <p className="text-sm text-emerald-600">Settings saved.</p>
      ) : null}
      <input type="hidden" name="shopId" value={store.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="lowStockThreshold" className="text-sm font-medium">
            Low stock threshold
          </label>
          <input
            id="lowStockThreshold"
            name="lowStockThreshold"
            type="number"
            min={0}
            required
            defaultValue={store.lowStockThreshold}
            className={agencyButtonClass.input}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="syncFrequency" className="text-sm font-medium">
            Sync frequency
          </label>
          <select
            id="syncFrequency"
            name="syncFrequency"
            defaultValue={store.syncFrequency}
            className={agencyButtonClass.input}
          >
            <option value="manual">Manual</option>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
          </select>
        </div>
      </div>
      <button type="submit" className={agencyButtonClass.primary}>
        Save settings
      </button>
    </form>
  );
};
