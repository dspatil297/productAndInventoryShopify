export const DEFAULT_INVENTORY_PAGE_SIZE = 20;

export const INVENTORY_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export type InventoryPageSize = (typeof INVENTORY_PAGE_SIZE_OPTIONS)[number];

export const INVENTORY_QUANTITY_NAMES = [
  "available",
  "on_hand",
  "committed",
  "incoming",
] as const;

export const INVENTORY_SET_REASON = "correction";
export const INVENTORY_ADJUST_REASON = "correction";
export const INVENTORY_QUANTITY_NAME = "available";
