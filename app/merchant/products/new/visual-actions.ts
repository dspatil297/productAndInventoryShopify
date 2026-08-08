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
import { productEditPath } from "@/lib/products/product-gid";
import { getVisualTemplate } from "@/lib/products/visual-templates";

function redirectWithFlash(path: string, flash: Record<string, string>): never {
  const url = new URL(path, "https://local.invalid");
  for (const [key, value] of Object.entries(flash)) {
    url.searchParams.set(key, value);
  }
  redirect(`${url.pathname}${url.search}`);
}

export async function createVisualMerchantProductAction(
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

  const templateId = String(formData.get("templateId") ?? "");
  const template = getVisualTemplate(templateId);
  const failPath = template
    ? `/merchant/products/new?view=visual&template=${template.id}`
    : "/merchant/products/new?view=visual";

  const shopWithConfig = await getShopWithConfig(shop.id);
  const definitions = readMetafieldDefinitionsFromConfig(
    shopWithConfig?.config,
  );

  let parsed;
  try {
    parsed = parseProductCreateFromFormData(
      formData,
      definitions,
      failPath,
    );
  } catch (error) {
    if (error instanceof ProductCreateFormError) {
      redirectWithFlash(failPath, { error: error.message });
    }
    throw error;
  }

  if (!parsed.title.trim()) {
    redirectWithFlash(failPath, { error: "Title is required — fill it on the template" });
  }

  const result = await createShopProduct(shopWithConfig ?? shop, {
    title: parsed.title,
    handle: parsed.handle || undefined,
    descriptionHtml: parsed.descriptionHtml || undefined,
    productType: parsed.productType || undefined,
    vendor: parsed.vendor || undefined,
    status: parsed.status,
    templateSuffix: parsed.templateSuffix || null,
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
    redirectWithFlash(failPath, {
      error: result.errors[0] ?? "Create failed",
    });
  }

  const editPath = productEditPath(result.productId, "simple");
  if (result.errors.length > 0) {
    redirectWithFlash(editPath, {
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
