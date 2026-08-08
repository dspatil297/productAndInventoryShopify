import {
  DEFAULT_PAGE_SIZE,
  PRODUCT_PAGE_SIZE_OPTIONS,
  type ProductPageSize,
} from "@/lib/products/constants";

export interface ProductListUrlState {
  first: ProductPageSize;
  search: string;
  productType: string;
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

function parsePageSize(raw: string | undefined): ProductPageSize {
  const value = Number.parseInt(raw ?? "", 10);
  if (PRODUCT_PAGE_SIZE_OPTIONS.includes(value as ProductPageSize)) {
    return value as ProductPageSize;
  }
  return DEFAULT_PAGE_SIZE;
}

function parseCursorHistory(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw.split(",").map((part) => part.trim()).filter(Boolean);
}

export function parseProductListUrlState(
  searchParams: Record<string, string | string[] | undefined>,
): ProductListUrlState {
  const first = parsePageSize(readString(searchParams, "first"));
  const search = readString(searchParams, "search") ?? "";
  const productType = readString(searchParams, "productType") ?? "";
  const history = parseCursorHistory(readString(searchParams, "h"));
  const after = history.length > 0 ? history[history.length - 1] : undefined;

  return { first, search, productType, history, after };
}

interface BuildProductListQueryInput {
  first?: ProductPageSize;
  search?: string;
  productType?: string;
  history?: string[];
  shop?: string;
  host?: string;
}

export function buildProductListQuery(
  input: BuildProductListQueryInput,
): string {
  const params = new URLSearchParams();

  if (input.first && input.first !== DEFAULT_PAGE_SIZE) {
    params.set("first", String(input.first));
  }
  if (input.search) {
    params.set("search", input.search);
  }
  if (input.productType) {
    params.set("productType", input.productType);
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

export function buildProductListHref(
  basePath: string,
  input: BuildProductListQueryInput,
): string {
  const query = buildProductListQuery(input);
  return query ? `${basePath}?${query}` : basePath;
}

export function buildNextPageHref(
  basePath: string,
  state: ProductListUrlState,
  endCursor: string,
  embedded?: { shop?: string; host?: string },
): string {
  return buildProductListHref(basePath, {
    first: state.first,
    search: state.search,
    productType: state.productType,
    history: [...state.history, endCursor],
    shop: embedded?.shop,
    host: embedded?.host,
  });
}

export function buildPreviousPageHref(
  basePath: string,
  state: ProductListUrlState,
  embedded?: { shop?: string; host?: string },
): string | null {
  if (state.history.length === 0) {
    return null;
  }

  return buildProductListHref(basePath, {
    first: state.first,
    search: state.search,
    productType: state.productType,
    history: state.history.slice(0, -1),
    shop: embedded?.shop,
    host: embedded?.host,
  });
}

export function buildPageSizeHref(
  basePath: string,
  state: ProductListUrlState,
  first: ProductPageSize,
  embedded?: { shop?: string; host?: string },
): string {
  return buildProductListHref(basePath, {
    first,
    search: state.search,
    productType: state.productType,
    history: [],
    shop: embedded?.shop,
    host: embedded?.host,
  });
}

export function buildFilterHref(
  basePath: string,
  input: {
    first: ProductPageSize;
    search: string;
    productType: string;
  },
  embedded?: { shop?: string; host?: string },
): string {
  return buildProductListHref(basePath, {
    first: input.first,
    search: input.search,
    productType: input.productType,
    history: [],
    shop: embedded?.shop,
    host: embedded?.host,
  });
}

export function buildClearFiltersHref(
  basePath: string,
  embedded?: { shop?: string; host?: string },
): string {
  return buildProductListHref(basePath, {
    shop: embedded?.shop,
    host: embedded?.host,
  });
}
