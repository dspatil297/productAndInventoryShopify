import { appFormRedirect } from "@/lib/agency/app-url";
import { adjustShopInventoryQuantities } from "@/lib/inventory/adjust-quantities";
import {
  appendInventoryFlashParams,
  parseInventoryBulkAdjustFromFormData,
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
  const fallback = `/merchant/inventory`;
  const returnTo = safeInventoryReturnTo(formData.get("returnTo"), fallback);
  const idempotencyKey =
    typeof formData.get("idempotencyKey") === "string"
      ? String(formData.get("idempotencyKey"))
      : undefined;

  try {
    const shop = await requireShopApiAccess(request, shopId);
    const changes = parseInventoryBulkAdjustFromFormData(formData);

    if (changes.length === 0) {
      return redirectAfterForm(request, returnTo, {
        error: "Select at least one row (or invalid adjust payload)",
      });
    }

    const result = await adjustShopInventoryQuantities(shop, changes, {
      idempotencyKey,
    });

    if (result.errors.length > 0 && result.updated === 0) {
      return redirectAfterForm(request, returnTo, {
        error: result.errors[0]?.message ?? "Failed to adjust inventory",
      });
    }

    if (result.errors.length > 0) {
      return redirectAfterForm(request, returnTo, {
        saved: String(result.updated),
        error: `${result.errors.length} failed. First: ${result.errors[0]?.message ?? "Unknown"}`,
      });
    }

    return redirectAfterForm(request, returnTo, {
      saved: String(result.updated),
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
