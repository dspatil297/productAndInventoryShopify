export interface ProductVariantRow {
  id: string;
  sku: string | null;
  price: string;
}

export interface ProductListItem {
  id: string;
  title: string;
  handle: string;
  productType: string;
  status: string;
  imageUrl: string | null;
  imageAlt: string;
  variants: ProductVariantRow[];
  skus: string;
  priceRange: string;
}

export interface ProductsListResponse {
  products: ProductListItem[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
}
