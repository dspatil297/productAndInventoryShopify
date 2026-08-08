import { appFormRedirect } from "@/lib/agency/app-url";
import {
  appendInventoryFlashParams,
  parseInventoryBulkSetFromFormData,
  safeInventoryReturnTo,
} from "@/lib/inventory/form-fields";
import { moveShopInventoryQuantities } from "@/lib/inventory/move-quantities";
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

function readPositiveInt(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function POST(request: Request, context: RouteContext) {
  const { shopId } = await context.params;
  const formData = await request.formData();
  const fallback = `/merchant/inventory`;
  const returnTo = safeInventoryReturnTo(formData.get("returnTo"), fallback);

  try {
    const shop = await requireShopApiAccess(request, shopId);
    const fromLocationId = formData.get("locationId");
    const toLocationId = formData.get("toLocationId");

    if (typeof fromLocationId !== "string" || !fromLocationId) {
      return redirectAfterForm(request, returnTo, {
        error: "Missing source location",
      });
    }

    if (typeof toLocationId !== "string" || !toLocationId) {
      return redirectAfterForm(request, returnTo, {
        error: "Pick a destination location",
      });
    }

    if (fromLocationId === toLocationId) {
      return redirectAfterForm(request, returnTo, {
        error: "Destination must differ from current location",
      });
    }

    // Reuse pick parser (needs quantity field present)
    const formForParse = new FormData();
    formForParse.set("locationId", fromLocationId);
    formForParse.set("quantity", "0");
    for (const pick of formData.getAll("pick")) {
      if (typeof pick === "string") {
        formForParse.append("pick", pick);
      }
    }

    const picks = parseInventoryBulkSetFromFormData(formForParse);
    if (picks.length === 0) {
      return redirectAfterForm(request, returnTo, {
        error: "Select at least one row to move",
      });
    }

    const moveQuantity = readPositiveInt(formData.get("moveQuantity"));

    const moves = picks.map((pick) => {
      const available =
        typeof pick.changeFromQuantity === "number"
          ? pick.changeFromQuantity
          : 0;
      const quantity = moveQuantity ?? available;
      return {
        inventoryItemId: pick.inventoryItemId,
        fromLocationId,
        toLocationId,
        quantity,
      };
    });

    const invalid = moves.find((move) => move.quantity <= 0);
    if (invalid) {
      return redirectAfterForm(request, returnTo, {
        error:
          "Move qty missing — set Move qty, or select rows that have available stock",
      });
    }

    const result = await moveShopInventoryQuantities(shop, moves);

    if (result.errors.length > 0 && result.updated === 0) {
      return redirectAfterForm(request, returnTo, {
        error: result.errors[0]?.message ?? "Failed to move inventory",
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
