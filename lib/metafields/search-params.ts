import { DEFAULT_PAGE_SIZE } from "@/lib/products/constants";

export interface MetafieldListUrlState {
  first: number;
  search: string;
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

function parseCursorHistory(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw.split(",").map((part) => part.trim()).filter(Boolean);
}

export function parseMetafieldListUrlState(
  searchParams: Record<string, string | string[] | undefined>,
): MetafieldListUrlState {
  const firstRaw = Number.parseInt(readString(searchParams, "first") ?? "", 10);
  const first =
    Number.isFinite(firstRaw) && firstRaw >= 1 && firstRaw <= 50
      ? firstRaw
      : DEFAULT_PAGE_SIZE;
  const search = readString(searchParams, "search") ?? "";
  const history = parseCursorHistory(readString(searchParams, "h"));
  const after = history.length > 0 ? history[history.length - 1] : undefined;

  return { first, search, history, after };
}

interface BuildMetafieldListQueryInput {
  first?: number;
  search?: string;
  history?: string[];
  shop?: string;
  host?: string;
}

export function buildMetafieldListQuery(
  input: BuildMetafieldListQueryInput,
): string {
  const params = new URLSearchParams();

  if (input.first && input.first !== DEFAULT_PAGE_SIZE) {
    params.set("first", String(input.first));
  }
  if (input.search) {
    params.set("search", input.search);
  }
  if (input.history?.length) {
    params.set("h", input.history.join(","));
  }
  if (input.shop) {
    params.set("shop", input.shop);
  }
  if (input.host) {
    params.set("host", input.host);
  }

  return params.toString();
}

export function buildMetafieldListHref(
  basePath: string,
  input: BuildMetafieldListQueryInput,
): string {
  const query = buildMetafieldListQuery(input);
  return query ? `${basePath}?${query}` : basePath;
}

export function buildMetafieldNextPageHref(
  basePath: string,
  state: MetafieldListUrlState,
  endCursor: string,
  embedded?: { shop?: string; host?: string },
): string {
  return buildMetafieldListHref(basePath, {
    first: state.first,
    search: state.search,
    history: [...state.history, endCursor],
    shop: embedded?.shop,
    host: embedded?.host,
  });
}

export function buildMetafieldPreviousPageHref(
  basePath: string,
  state: MetafieldListUrlState,
  embedded?: { shop?: string; host?: string },
): string | null {
  if (state.history.length === 0) {
    return null;
  }

  return buildMetafieldListHref(basePath, {
    first: state.first,
    search: state.search,
    history: state.history.slice(0, -1),
    shop: embedded?.shop,
    host: embedded?.host,
  });
}

export function buildMetafieldFilterHref(
  basePath: string,
  input: { first: number; search: string },
  embedded?: { shop?: string; host?: string },
): string {
  return buildMetafieldListHref(basePath, {
    first: input.first,
    search: input.search,
    history: [],
    shop: embedded?.shop,
    host: embedded?.host,
  });
}

export function buildMetafieldClearFiltersHref(
  basePath: string,
  embedded?: { shop?: string; host?: string },
): string {
  return buildMetafieldListHref(basePath, {
    shop: embedded?.shop,
    host: embedded?.host,
  });
}
