// Shopify `metafieldsSet` enforces a max of 25 metafields per request.
export const METAFIELD_BATCH_SIZE = 25;

export const METAFIELD_UNSUPPORTED_TYPES = [
  "file_reference",
  "product_reference",
] as const;
