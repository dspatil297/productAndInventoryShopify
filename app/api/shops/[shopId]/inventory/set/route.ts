import { appFormRedirect } from "@/lib/agency/app-url";
import { enableShopInventoryTracking } from "@/lib/inventory/enable-tracking";
import {
  appendInventoryFlashParams,
  parseInventoryBulkSetFromFormData,
  safeInventoryReturnTo,
} from "@/lib/inventory/form-fields";
import { setShopInventoryQuantities } from "@/lib/inventory/set-quantities";
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
  const bulkAction = String(formData.get("bulkAction") ?? "set");

  try {
    const shop = await requireShopApiAccess(request, shopId);

    if (bulkAction === "enable") {
      // Reuse pick parser with dummy quantity — only need item ids + location
      const formForParse = new FormData();
      formForParse.set("locationId", String(formData.get("locationId") ?? ""));
      formForParse.set("quantity", "0");
      for (const pick of formData.getAll("pick")) {
        if (typeof pick === "string") {
          formForParse.append("pick", pick);
        }
      }

      const updates = parseInventoryBulkSetFromFormData(formForParse);
      if (updates.length === 0) {
        return redirectAfterForm(request, returnTo, {
          error: "Select at least one row to enable tracking",
        });
      }

      const result = await enableShopInventoryTracking(
        shop,
        updates.map((update) => ({
          inventoryItemId: update.inventoryItemId,
          locationId: update.locationId,
        })),
      );

      if (result.errors.length > 0 && result.updated === 0) {
        return redirectAfterForm(request, returnTo, {
          error: result.errors[0]?.message ?? "Failed to enable tracking",
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
    }

    const updates = parseInventoryBulkSetFromFormData(formData);

    if (updates.length === 0) {
      return redirectAfterForm(request, returnTo, {
        error: "Select at least one row (or invalid set payload)",
      });
    }

    const result = await setShopInventoryQuantities(shop, updates, {
      idempotencyKey,
    });

    if (result.errors.length > 0 && result.updated === 0) {
      return redirectAfterForm(request, returnTo, {
        error: result.errors[0]?.message ?? "Failed to set inventory",
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
