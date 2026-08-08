import { appFormRedirect } from "@/lib/agency/app-url";
import {
  appendMetafieldFlashParams,
  parseMetafieldUpdatesFromFormData,
  safeMetafieldReturnTo,
} from "@/lib/metafields/form-fields";
import { setShopMetafields } from "@/lib/metafields/set-metafields";
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
    const updates = parseMetafieldUpdatesFromFormData(formData);

    if (updates.length === 0) {
      return redirectAfterForm(request, returnTo, {
        error: "No changes to save",
      });
    }

    const result = await setShopMetafields(shop, updates);

    if (result.errors.length > 0) {
      return redirectAfterForm(request, returnTo, {
        error: `${result.errors.length} cell(s) failed. First: ${result.errors[0]?.message ?? "Unknown"}`,
        saved: String(result.saved),
      });
    }

    return redirectAfterForm(request, returnTo, {
      saved: String(result.saved),
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
