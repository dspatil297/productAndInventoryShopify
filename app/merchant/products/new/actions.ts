"use server";

import { redirect } from "next/navigation";
import { getShopWithConfig } from "@/lib/db/shops";
import { readMetafieldDefinitionsFromConfig } from "@/lib/metafields/config";
import {
  MerchantPortalAuthError,
  requireMerchantPortalShop,
} from "@/lib/merchant/auth";
import { createShopProduct } from "@/lib/products/create-product";
import {
  parseProductCreateFromFormData,
  ProductCreateFormError,
} from "@/lib/products/form-fields";

function redirectWithFlash(path: string, flash: Record<string, string>): never {
  const url = new URL(path, "https://local.invalid");
  for (const [key, value] of Object.entries(flash)) {
    url.searchParams.set(key, value);
  }
  redirect(`${url.pathname}${url.search}`);
}

export async function createMerchantProductAction(
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
    parsed = parseProductCreateFromFormData(
      formData,
      definitions,
      "/merchant/products/new",
    );
  } catch (error) {
    if (error instanceof ProductCreateFormError) {
      redirectWithFlash("/merchant/products/new", { error: error.message });
    }
    throw error;
  }

  const result = await createShopProduct(shopWithConfig ?? shop, {
    title: parsed.title,
    handle: parsed.handle || undefined,
    descriptionHtml: parsed.descriptionHtml || undefined,
    productType: parsed.productType || undefined,
    vendor: parsed.vendor || undefined,
    status: parsed.status,
    price: parsed.price || undefined,
    compareAtPrice: parsed.compareAtPrice || undefined,
    sku: parsed.sku || undefined,
    inventoryPolicy: parsed.inventoryPolicy,
    trackInventory: parsed.trackInventory,
    inventoryQuantity: parsed.inventoryQuantity,
    locationId: parsed.locationId || null,
    publish: parsed.publish,
    metafields: parsed.metafields,
    images: parsed.images,
  });

  if (!result.productId) {
    redirectWithFlash(parsed.returnTo, {
      error: result.errors[0] ?? "Create failed",
    });
  }

  if (result.errors.length > 0) {
    redirectWithFlash("/merchant/products", {
      saved: "1",
      created: result.title ?? "1",
      error: `Created with warnings: ${result.errors[0]}`,
    });
  }

  redirectWithFlash("/merchant/products", {
    saved: "1",
    created: result.title ?? "1",
  });
}
