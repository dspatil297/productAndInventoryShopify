import type { Shop } from "@/generated/prisma/client";
import { productGidFromParam } from "@/lib/products/product-gid";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import { PRODUCT_DELETE_MUTATION } from "@/lib/shopify/mutations";

const MAX_BULK_DELETE = 50;

export interface DeleteProductsResult {
  deleted: number;
  errors: Array<{ productId: string; message: string }>;
}

interface ProductDeleteResponse {
  productDelete: {
    deletedProductId: string | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

export function parseProductDeleteIds(formData: FormData): string[] {
  const ids = new Set<string>();
  for (const pick of formData.getAll("pick")) {
    if (typeof pick !== "string") {
      continue;
    }
    const gid = productGidFromParam(pick);
    if (gid) {
      ids.add(gid);
    }
  }
  return [...ids];
}

export async function deleteShopProducts(
  shop: Shop,
  productIds: string[],
): Promise<DeleteProductsResult> {
  const uniqueIds = [...new Set(productIds)];
  if (uniqueIds.length === 0) {
    return { deleted: 0, errors: [] };
  }
  if (uniqueIds.length > MAX_BULK_DELETE) {
    return {
      deleted: 0,
      errors: [
        {
          productId: "",
          message: `Select at most ${MAX_BULK_DELETE} products per delete`,
        },
      ],
    };
  }

  let deleted = 0;
  const errors: DeleteProductsResult["errors"] = [];

  for (const productId of uniqueIds) {
    const data = await shopifyGraphqlForShop<ProductDeleteResponse>(
      shop,
      PRODUCT_DELETE_MUTATION,
      { input: { id: productId } },
    );

    const userErrors = data.productDelete.userErrors;
    if (userErrors.length > 0) {
      for (const userError of userErrors) {
        errors.push({ productId, message: userError.message });
      }
      continue;
    }

    if (data.productDelete.deletedProductId) {
      deleted += 1;
    } else {
      errors.push({ productId, message: "Product delete failed" });
    }
  }

  return { deleted, errors };
}
