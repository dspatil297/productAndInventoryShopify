import { appFormRedirect } from "@/lib/agency/app-url";
import {
  deleteShopProducts,
  parseProductDeleteIds,
} from "@/lib/products/delete-products";
import {
  appendInventoryFlashParams,
  safeInventoryReturnTo,
} from "@/lib/inventory/form-fields";
import {
  isShopApiAccessError,
  requireShopApiAccess,
} from "@/lib/shops/api-access";

interface RouteContext {
  params: Promise<{ shopId: string }>;
}

function redirectAfterForm(
  request: Request,
  returnTo: string,
  flash: Record<string, string>,
): Response {
  const target = appendInventoryFlashParams(returnTo, flash);
  return appFormRedirect(request, target);
}

export async function POST(request: Request, context: RouteContext) {
  const { shopId } = await context.params;
  const formData = await request.formData();
  const fallback = "/merchant/products";
  const returnTo = safeInventoryReturnTo(formData.get("returnTo"), fallback);
  const productIds = parseProductDeleteIds(formData);

  if (productIds.length === 0) {
    return redirectAfterForm(request, returnTo, {
      error: "Select at least one product to delete",
    });
  }

  try {
    const shop = await requireShopApiAccess(request, shopId);
    const result = await deleteShopProducts(shop, productIds);

    if (result.errors.length > 0 && result.deleted === 0) {
      return redirectAfterForm(request, returnTo, {
        error: result.errors[0]?.message ?? "Failed to delete products",
      });
    }

    if (result.errors.length > 0) {
      return redirectAfterForm(request, returnTo, {
        deleted: String(result.deleted),
        error: `${result.errors.length} failed. First: ${result.errors[0]?.message ?? "Unknown"}`,
      });
    }

    return redirectAfterForm(request, returnTo, {
      deleted: String(result.deleted),
    });
  } catch (error) {
    if (isShopApiAccessError(error)) {
      return redirectAfterForm(request, returnTo, {
        error: error.message,
      });
    }
    throw error;
  }
}
