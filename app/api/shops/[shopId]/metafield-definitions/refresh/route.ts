import { appFormRedirect } from "@/lib/agency/app-url";
import {
  appendMetafieldFlashParams,
  safeMetafieldReturnTo,
} from "@/lib/metafields/form-fields";
import { refreshMetafieldDefinitionsForShop } from "@/lib/metafields/refresh-definitions";
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
  const target = appendMetafieldFlashParams(returnTo, flash);
  return appFormRedirect(request, target);
}

export async function POST(request: Request, context: RouteContext) {
  const { shopId } = await context.params;
  const formData = await request.formData();
  const fallback = `/agency/stores/${shopId}/metafields`;
  const returnTo = safeMetafieldReturnTo(formData.get("returnTo"), fallback);

  try {
    const shop = await requireShopApiAccess(request, shopId);
    await refreshMetafieldDefinitionsForShop(shop);
    return redirectAfterForm(request, returnTo, { refreshed: "1" });
  } catch (error) {
    if (isShopApiAccessError(error)) {
      return redirectAfterForm(request, returnTo, {
        error: error.message,
      });
    }
    throw error;
  }
}
