export interface ShopLocation {
  id: string;
  name: string;
  isActive: boolean;
  address: {
    city: string | null;
    country: string | null;
  } | null;
}

export interface InventoryQuantityMap {
  available: number | null;
  onHand: number | null;
  committed: number | null;
  incoming: number | null;
}

export interface InventoryRow {
  variantId: string;
  variantTitle: string;
  displayName: string;
  sku: string | null;
  productId: string;
  productTitle: string;
  productHandle: string;
  productType: string;
  inventoryItemId: string;
  tracked: boolean;
  quantities: InventoryQuantityMap;
}

export interface InventoryListResponse {
  locationId: string;
  locationName: string;
  lowStockThreshold: number;
  rows: InventoryRow[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
}

export interface InventorySetInput {
  inventoryItemId: string;
  locationId: string;
  quantity: number;
  changeFromQuantity: number | null;
}

export interface InventoryAdjustInput {
  inventoryItemId: string;
  locationId: string;
  delta: number;
}

export interface InventoryWriteResult {
  updated: number;
  errors: Array<{ message: string; inventoryItemId?: string }>;
}
