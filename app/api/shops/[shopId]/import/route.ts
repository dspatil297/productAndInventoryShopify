import { appFormRedirect } from "@/lib/agency/app-url";
import { importProductsFromCsv } from "@/lib/csv/productImport";
import { readMetafieldDefinitionsFromConfig } from "@/lib/metafields/config";
import {
  appendProductFlashParams,
  safeProductReturnTo,
} from "@/lib/products/form-fields";
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
  const target = appendProductFlashParams(returnTo, flash);
  return appFormRedirect(request, target);
}

export async function POST(request: Request, context: RouteContext) {
  const { shopId } = await context.params;
  const formData = await request.formData();
  const returnTo = safeProductReturnTo(
    formData.get("returnTo"),
    "/merchant/import",
  );

  try {
    const shop = await requireShopApiAccess(request, shopId);
    const definitions = readMetafieldDefinitionsFromConfig(shop.config);
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return redirectAfterForm(request, returnTo, {
        error: "Choose a CSV file to import",
      });
    }

    const csvText = await file.text();
    const result = await importProductsFromCsv(shop, csvText, definitions);

    if (result.created === 0 && result.errors.length > 0) {
      return redirectAfterForm(request, returnTo, {
        error: result.errors[0]?.message ?? "Import failed",
      });
    }

    if (result.errors.length > 0) {
      return redirectAfterForm(request, returnTo, {
        saved: String(result.created),
        error: `${result.errors.length} issue(s). First: ${result.errors[0]?.message ?? "Unknown"}`,
      });
    }

    return redirectAfterForm(request, returnTo, {
      saved: String(result.created),
    });
  } catch (error) {
    if (isShopApiAccessError(error)) {
      return redirectAfterForm(request, returnTo, { error: error.message });
    }
    throw error;
  }
}
