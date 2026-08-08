"use server";

import { redirect } from "next/navigation";
import { getShopWithConfig } from "@/lib/db/shops";
import { readMetafieldDefinitionsFromConfig } from "@/lib/metafields/config";
import {
  MerchantPortalAuthError,
  requireMerchantPortalShop,
} from "@/lib/merchant/auth";
import {
  parseProductEditFromFormData,
  ProductCreateFormError,
} from "@/lib/products/form-fields";
import { productEditPath, productNumericId } from "@/lib/products/product-gid";
import { updateShopProduct } from "@/lib/products/update-product";

function redirectWithFlash(path: string, flash: Record<string, string>): never {
  const url = new URL(path, "https://local.invalid");
  for (const [key, value] of Object.entries(flash)) {
    url.searchParams.set(key, value);
  }
  redirect(`${url.pathname}${url.search}`);
}

export async function updateMerchantProductAction(
  formData: FormData,
): Promise<void> {
  let shop;
  try {
    shop = await requireMerchantPortalShop();
  } catch (error) {
    if (error instanceof MerchantPortalAuthError) {
      redirectWithFlash("/login", {
        error: "Session expired — sign in again",
      });
    }
    throw error;
  }

  const shopWithConfig = await getShopWithConfig(shop.id);
  const definitions = readMetafieldDefinitionsFromConfig(
    shopWithConfig?.config,
  );

  let parsed;
  try {
    parsed = parseProductEditFromFormData(
      formData,
      definitions,
      "/merchant/products",
    );
  } catch (error) {
    if (error instanceof ProductCreateFormError) {
      redirectWithFlash("/merchant/products", { error: error.message });
    }
    throw error;
  }

  let editPath: string;
  try {
    editPath =
      parsed.view === "visual"
        ? productEditPath(
            parsed.productId,
            "visual",
            parsed.templateSuffix,
          )
        : productEditPath(
            parsed.productId,
            parsed.view === "preview" ? "visual" : "simple",
          );
  } catch {
    redirectWithFlash("/merchant/products", { error: "Invalid product id" });
  }

  const result = await updateShopProduct(shopWithConfig ?? shop, {
    productId: parsed.productId,
    title: parsed.title,
    handle: parsed.handle || undefined,
    descriptionHtml: parsed.descriptionHtml,
    productType: parsed.productType,
    vendor: parsed.vendor,
    status: parsed.status,
    variantId: parsed.variantId || null,
    price: parsed.price || undefined,
    compareAtPrice: parsed.compareAtPrice,
    sku: parsed.sku,
    inventoryPolicy: parsed.inventoryPolicy,
    metafields: parsed.metafields,
  });

  if (!result.productId) {
    redirectWithFlash(editPath, {
      error: result.errors[0] ?? "Update failed",
    });
  }

  const numericId = productNumericId(result.productId);
  const successPath =
    parsed.view === "visual"
      ? productEditPath(
          `gid://shopify/Product/${numericId}`,
          "visual",
          parsed.templateSuffix,
        )
      : productEditPath(`gid://shopify/Product/${numericId}`, "simple");

  if (result.errors.length > 0) {
    redirectWithFlash(successPath, {
      saved: "1",
      error: `Saved with warnings: ${result.errors[0]}`,
    });
  }

  redirectWithFlash(successPath, { saved: "1" });
}
