export const DEFAULT_PAGE_SIZE = 20;

export const PRODUCT_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export type ProductPageSize = (typeof PRODUCT_PAGE_SIZE_OPTIONS)[number];
