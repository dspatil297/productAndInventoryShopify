import type { Shop, ShopConfig } from "@/generated/prisma/client";
import {
  DEFAULT_INVENTORY_PAGE_SIZE,
  INVENTORY_QUANTITY_NAMES,
} from "@/lib/inventory/constants";
import {
  findLocationById,
  pickDefaultLocation,
  readLocationsFromConfig,
} from "@/lib/inventory/locations";
import type {
  InventoryStockFilter,
  InventoryTrackedFilter,
} from "@/lib/inventory/search-params";
import type {
  InventoryListResponse,
  InventoryQuantityMap,
  InventoryRow,
} from "@/lib/inventory/types";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import { INVENTORY_AT_LOCATION_QUERY } from "@/lib/shopify/queries";

interface InventoryGraphqlResponse {
  productVariants: {
    edges: Array<{
      cursor: string;
      node: {
        id: string;
        title: string;
        sku: string | null;
        displayName: string;
        product: {
          id: string;
          title: string;
          handle: string;
          productType: string | null;
        };
        inventoryItem: {
          id: string;
          tracked: boolean;
          inventoryLevel: {
            id: string;
            quantities: Array<{ name: string; quantity: number }>;
          } | null;
        };
      };
    }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
}

export interface ListShopInventoryInput {
  locationId?: string | null;
  first?: number;
  after?: string | null;
  search?: string | null;
  productType?: string | null;
  tracked?: InventoryTrackedFilter;
  stock?: InventoryStockFilter;
}

const SHOPIFY_FETCH_SIZE = 50;
// ponytail: scan ceiling when local filters sparse — bump if huge catalogs miss matches
const MAX_SCAN_PAGES = 30;

function escapeShopifyQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function buildInventorySearchQuery(input: {
  search?: string | null;
  productType?: string | null;
}): string | undefined {
  const parts: string[] = [];

  if (input.productType?.trim()) {
    parts.push(
      `product_type:'${escapeShopifyQueryValue(input.productType.trim())}'`,
    );
  }

  const term = input.search?.trim();
  if (term) {
    const escaped = escapeShopifyQueryValue(term);
    parts.push(
      `(sku:*${escaped}* OR title:*${escaped}* OR product_title:*${escaped}*)`,
    );
  }

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join(" AND ");
}

function readQuantityMap(
  quantities: Array<{ name: string; quantity: number }> | undefined,
): InventoryQuantityMap {
  const byName = new Map(
    (quantities ?? []).map((entry) => [entry.name, entry.quantity]),
  );

  return {
    available: byName.has("available") ? (byName.get("available") ?? null) : null,
    onHand: byName.has("on_hand") ? (byName.get("on_hand") ?? null) : null,
    committed: byName.has("committed") ? (byName.get("committed") ?? null) : null,
    incoming: byName.has("incoming") ? (byName.get("incoming") ?? null) : null,
  };
}

function matchesTrackedFilter(
  row: InventoryRow,
  tracked: InventoryTrackedFilter = "all",
): boolean {
  if (tracked === "tracked") {
    return row.tracked;
  }
  if (tracked === "untracked") {
    return !row.tracked;
  }
  return true;
}

function matchesStockFilter(
  row: InventoryRow,
  threshold: number,
  stock: InventoryStockFilter = "all",
): boolean {
  const available = row.quantities.available;

  if (stock === "unstocked") {
    return available === null;
  }
  if (stock === "out") {
    return available !== null && available <= 0;
  }
  if (stock === "low") {
    return available !== null && available > 0 && available <= threshold;
  }
  if (stock === "in_stock") {
    return available !== null && available > threshold;
  }
  return true;
}

function needsLocalFilter(input: ListShopInventoryInput): boolean {
  return (
    (input.tracked !== undefined && input.tracked !== "all") ||
    (input.stock !== undefined && input.stock !== "all")
  );
}

function mapEdgeToRow(
  edge: InventoryGraphqlResponse["productVariants"]["edges"][number],
): InventoryRow {
  const node = edge.node;
  return {
    variantId: node.id,
    variantTitle: node.title,
    displayName: node.displayName,
    sku: node.sku,
    productId: node.product.id,
    productTitle: node.product.title,
    productHandle: node.product.handle,
    productType: node.product.productType?.trim() || "",
    inventoryItemId: node.inventoryItem.id,
    tracked: node.inventoryItem.tracked,
    quantities: readQuantityMap(node.inventoryItem.inventoryLevel?.quantities),
  };
}

function rowMatches(
  row: InventoryRow,
  input: ListShopInventoryInput,
  threshold: number,
): boolean {
  return (
    matchesTrackedFilter(row, input.tracked) &&
    matchesStockFilter(row, threshold, input.stock)
  );
}

export async function listShopInventory(
  shop: Shop & { config: ShopConfig | null },
  input: ListShopInventoryInput = {},
): Promise<InventoryListResponse> {
  const locations = readLocationsFromConfig(shop.config);
  const selected =
    findLocationById(locations, input.locationId) ??
    pickDefaultLocation(locations);
  const lowStockThreshold = shop.config?.lowStockThreshold ?? 5;

  if (!selected) {
    return {
      locationId: "",
      locationName: "",
      lowStockThreshold,
      rows: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    };
  }

  const pageSize = input.first ?? DEFAULT_INVENTORY_PAGE_SIZE;
  const shopifyQuery = buildInventorySearchQuery({
    search: input.search,
    productType: input.productType,
  });

  // Fast path: no tracked/stock filter — one Shopify page
  if (!needsLocalFilter(input)) {
    const data = await shopifyGraphqlForShop<InventoryGraphqlResponse>(
      shop,
      INVENTORY_AT_LOCATION_QUERY,
      {
        first: pageSize,
        after: input.after ?? null,
        query: shopifyQuery,
        locationId: selected.id,
        names: [...INVENTORY_QUANTITY_NAMES],
      },
    );

    return {
      locationId: selected.id,
      locationName: selected.name,
      lowStockThreshold,
      rows: data.productVariants.edges.map(mapEdgeToRow),
      pageInfo: data.productVariants.pageInfo,
    };
  }

  // Scan forward until page filled with matches (tracked/stock are local-only)
  const matched: Array<{ row: InventoryRow; cursor: string }> = [];
  let after: string | null = input.after ?? null;
  let hasNextPage = false;
  let pagesScanned = 0;

  while (matched.length < pageSize && pagesScanned < MAX_SCAN_PAGES) {
    pagesScanned += 1;

    const data = await shopifyGraphqlForShop<InventoryGraphqlResponse>(
      shop,
      INVENTORY_AT_LOCATION_QUERY,
      {
        first: SHOPIFY_FETCH_SIZE,
        after,
        query: shopifyQuery,
        locationId: selected.id,
        names: [...INVENTORY_QUANTITY_NAMES],
      },
    );

    const edges = data.productVariants.edges;
    if (edges.length === 0) {
      hasNextPage = false;
      break;
    }

    for (let index = 0; index < edges.length; index += 1) {
      const edge = edges[index];
      if (!edge) {
        continue;
      }

      const row = mapEdgeToRow(edge);
      if (!rowMatches(row, input, lowStockThreshold)) {
        continue;
      }

      matched.push({ row, cursor: edge.cursor });

      if (matched.length === pageSize) {
        const rest = edges.slice(index + 1);
        const moreMatchInBatch = rest.some((nextEdge) =>
          rowMatches(mapEdgeToRow(nextEdge), input, lowStockThreshold),
        );
        hasNextPage =
          moreMatchInBatch || data.productVariants.pageInfo.hasNextPage;
        break;
      }
    }

    if (matched.length >= pageSize) {
      break;
    }

    if (!data.productVariants.pageInfo.hasNextPage) {
      hasNextPage = false;
      break;
    }

    after = data.productVariants.pageInfo.endCursor;
  }

  return {
    locationId: selected.id,
    locationName: selected.name,
    lowStockThreshold,
    rows: matched.map((entry) => entry.row),
    pageInfo: {
      hasNextPage,
      endCursor: matched[matched.length - 1]?.cursor ?? null,
    },
  };
}
