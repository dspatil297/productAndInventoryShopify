import {
  DEFAULT_INVENTORY_PAGE_SIZE,
  INVENTORY_PAGE_SIZE_OPTIONS,
  type InventoryPageSize,
} from "@/lib/inventory/constants";

export const INVENTORY_TRACKED_FILTERS = ["all", "tracked", "untracked"] as const;
export type InventoryTrackedFilter = (typeof INVENTORY_TRACKED_FILTERS)[number];

export const INVENTORY_STOCK_FILTERS = [
  "all",
  "in_stock",
  "low",
  "out",
  "unstocked",
] as const;
export type InventoryStockFilter = (typeof INVENTORY_STOCK_FILTERS)[number];

export interface InventoryListUrlState {
  first: InventoryPageSize;
  search: string;
  locationId: string;
  productType: string;
  tracked: InventoryTrackedFilter;
  stock: InventoryStockFilter;
  history: string[];
  after?: string;
}

function readString(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = searchParams[key];
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return undefined;
}

function parsePageSize(raw: string | undefined): InventoryPageSize {
  const value = Number.parseInt(raw ?? "", 10);
  if (INVENTORY_PAGE_SIZE_OPTIONS.includes(value as InventoryPageSize)) {
    return value as InventoryPageSize;
  }
  return DEFAULT_INVENTORY_PAGE_SIZE;
}

function parseTracked(raw: string | undefined): InventoryTrackedFilter {
  if (raw && INVENTORY_TRACKED_FILTERS.includes(raw as InventoryTrackedFilter)) {
    return raw as InventoryTrackedFilter;
  }
  return "all";
}

function parseStock(raw: string | undefined): InventoryStockFilter {
  if (raw && INVENTORY_STOCK_FILTERS.includes(raw as InventoryStockFilter)) {
    return raw as InventoryStockFilter;
  }
  return "all";
}

function parseCursorHistory(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw.split(",").map((part) => part.trim()).filter(Boolean);
}

export function parseInventoryListUrlState(
  searchParams: Record<string, string | string[] | undefined>,
): InventoryListUrlState {
  const first = parsePageSize(readString(searchParams, "first"));
  const search = readString(searchParams, "search") ?? "";
  const locationId = readString(searchParams, "location") ?? "";
  const productType = readString(searchParams, "productType") ?? "";
  const tracked = parseTracked(readString(searchParams, "tracked"));
  const stock = parseStock(readString(searchParams, "stock"));
  const history = parseCursorHistory(readString(searchParams, "h"));
  const after = history.length > 0 ? history[history.length - 1] : undefined;

  return {
    first,
    search,
    locationId,
    productType,
    tracked,
    stock,
    history,
    after,
  };
}

export interface BuildInventoryListQueryInput {
  first?: InventoryPageSize;
  search?: string;
  locationId?: string;
  productType?: string;
  tracked?: InventoryTrackedFilter;
  stock?: InventoryStockFilter;
  history?: string[];
}

export function buildInventoryListQuery(
  input: BuildInventoryListQueryInput,
): string {
  const params = new URLSearchParams();

  if (input.first && input.first !== DEFAULT_INVENTORY_PAGE_SIZE) {
    params.set("first", String(input.first));
  }
  if (input.search) {
    params.set("search", input.search);
  }
  if (input.locationId) {
    params.set("location", input.locationId);
  }
  if (input.productType) {
    params.set("productType", input.productType);
  }
  if (input.tracked && input.tracked !== "all") {
    params.set("tracked", input.tracked);
  }
  if (input.stock && input.stock !== "all") {
    params.set("stock", input.stock);
  }
  if (input.history?.length) {
    params.set("h", input.history.join(","));
  }

  return params.toString();
}

export function buildInventoryListHref(
  basePath: string,
  input: BuildInventoryListQueryInput,
): string {
  const query = buildInventoryListQuery(input);
  return query ? `${basePath}?${query}` : basePath;
}

function stateToQueryInput(
  state: InventoryListUrlState,
  overrides?: Partial<BuildInventoryListQueryInput>,
): BuildInventoryListQueryInput {
  return {
    first: state.first,
    search: state.search,
    locationId: state.locationId,
    productType: state.productType,
    tracked: state.tracked,
    stock: state.stock,
    history: state.history,
    ...overrides,
  };
}

export function buildInventoryNextPageHref(
  basePath: string,
  state: InventoryListUrlState,
  endCursor: string,
): string {
  return buildInventoryListHref(
    basePath,
    stateToQueryInput(state, {
      history: [...state.history, endCursor],
    }),
  );
}

export function buildInventoryPreviousPageHref(
  basePath: string,
  state: InventoryListUrlState,
): string | null {
  if (state.history.length === 0) {
    return null;
  }

  return buildInventoryListHref(
    basePath,
    stateToQueryInput(state, {
      history: state.history.slice(0, -1),
    }),
  );
}

export function buildInventoryLocationHref(
  basePath: string,
  state: InventoryListUrlState,
  locationId: string,
): string {
  return buildInventoryListHref(
    basePath,
    stateToQueryInput(state, { locationId, history: [] }),
  );
}

export function buildInventoryFilterHref(
  basePath: string,
  input: {
    first: InventoryPageSize;
    search: string;
    locationId: string;
    productType: string;
    tracked: InventoryTrackedFilter;
    stock: InventoryStockFilter;
  },
): string {
  return buildInventoryListHref(basePath, {
    ...input,
    history: [],
  });
}

export function buildInventoryClearFiltersHref(
  basePath: string,
  locationId: string,
): string {
  return buildInventoryListHref(basePath, {
    locationId,
    history: [],
  });
}

export function inventoryHasActiveFilters(state: InventoryListUrlState): boolean {
  return Boolean(
    state.search ||
      state.productType ||
      state.tracked !== "all" ||
      state.stock !== "all",
  );
}
