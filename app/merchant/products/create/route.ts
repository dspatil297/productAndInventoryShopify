import { appFormRedirect } from "@/lib/agency/app-url";
import { getShopWithConfig } from "@/lib/db/shops";
import { readMetafieldDefinitionsFromConfig } from "@/lib/metafields/config";
import {
  MerchantPortalAuthError,
  requireMerchantPortalShop,
} from "@/lib/merchant/auth";
import { createShopProduct } from "@/lib/products/create-product";
import {
  appendProductFlashParams,
  parseProductCreateFromFormData,
  ProductCreateFormError,
} from "@/lib/products/form-fields";

function redirectAfterForm(
  request: Request,
  returnTo: string,
  flash: Record<string, string>,
): Response {
  const target = appendProductFlashParams(returnTo, flash);
  return appFormRedirect(request, target);
}

/** Accidental GET / bookmark → back to form (avoids 405). */
export async function GET(request: Request) {
  return appFormRedirect(request, "/merchant/products/new");
}

/** Fallback native form POST target (server action is primary). */
export async function POST(request: Request) {
  const fallback = "/merchant/products/new";

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return redirectAfterForm(request, fallback, {
      error:
        "Upload too large or truncated. Use images under 4MB each, or create without images.",
    });
  }

  try {
    const shop = await requireMerchantPortalShop();
    const shopWithConfig = await getShopWithConfig(shop.id);
    const definitions = readMetafieldDefinitionsFromConfig(
      shopWithConfig?.config,
    );
    const parsed = parseProductCreateFromFormData(
      formData,
      definitions,
      fallback,
    );

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
      return redirectAfterForm(request, parsed.returnTo, {
        error: result.errors[0] ?? "Create failed",
      });
    }

    if (result.errors.length > 0) {
      return redirectAfterForm(request, "/merchant/products", {
        saved: "1",
        created: result.title ?? "1",
        error: `Created with warnings: ${result.errors[0]}`,
      });
    }

    return redirectAfterForm(request, "/merchant/products", {
      saved: "1",
      created: result.title ?? "1",
    });
  } catch (error) {
    if (error instanceof MerchantPortalAuthError) {
      return redirectAfterForm(request, "/login", {
        error: "Session expired — sign in again",
      });
    }
    if (error instanceof ProductCreateFormError) {
      return redirectAfterForm(request, fallback, { error: error.message });
    }
    throw error;
  }
}
