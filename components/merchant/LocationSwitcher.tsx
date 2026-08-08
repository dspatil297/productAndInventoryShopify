import type { InventoryListUrlState } from "@/lib/inventory/search-params";
import type { ShopLocation } from "@/lib/inventory/types";

interface LocationSwitcherProps {
  locations: ShopLocation[];
  selectedLocationId: string;
  /** kept for call-site compat; unused — native GET form owns navigation */
  listState?: InventoryListUrlState;
  basePath?: string;
  /** When set, select is a native form field (works without client JS) */
  name?: string;
}

export function LocationSwitcher({
  locations,
  selectedLocationId,
  name = "location",
}: LocationSwitcherProps) {
  if (locations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No locations cached. Sync store config from agency, or refresh locations.
      </p>
    );
  }

  return (
    <label className="flex min-w-[220px] flex-col gap-1 text-sm">
      <span className="text-muted-foreground">Location</span>
      <select
        name={name}
        className="rounded-md border border-border bg-background px-3 py-2"
        defaultValue={selectedLocationId}
      >
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
            {location.isActive ? "" : " (inactive)"}
          </option>
        ))}
      </select>
    </label>
  );
}
