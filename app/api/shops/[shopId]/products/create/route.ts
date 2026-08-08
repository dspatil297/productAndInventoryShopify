import { NextResponse } from "next/server";
import { appFormRedirect } from "@/lib/agency/app-url";
import { readMetafieldDefinitionsFromConfig } from "@/lib/metafields/config";
import { createShopProduct } from "@/lib/products/create-product";
import {
  appendProductFlashParams,
  parseProductCreateFromFormData,
} from "@/lib/products/form-fields";
import {
  isShopApiAccessError,
  requireShopApiAccess,
} from "@/lib/shops/api-access";

interface RouteContext {
  params: Promise<{ shopId: string }>;
}

function wantsJson(request: Request, isJsonBody: boolean): boolean {
  if (isJsonBody) {
    return true;
  }
  // Only explicit client fetch — browser form Accept often lists many types
  if (request.headers.get("x-requested-with") === "fetch") {
    return true;
  }
  const accept = request.headers.get("accept") ?? "";
  return accept.startsWith("application/json");
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
  const contentType = request.headers.get("content-type") ?? "";
  const isJsonBody = contentType.includes("application/json");
  const respondJson = wantsJson(request, isJsonBody);

  try {
    const shop = await requireShopApiAccess(request, shopId);
    const definitions = readMetafieldDefinitionsFromConfig(shop.config);

    if (isJsonBody) {
      const body = (await request.json()) as Record<string, unknown>;
      const result = await createShopProduct(shop, {
        title: String(body.title ?? ""),
        handle: typeof body.handle === "string" ? body.handle : undefined,
        descriptionHtml:
          typeof body.descriptionHtml === "string"
            ? body.descriptionHtml
            : undefined,
        productType:
          typeof body.productType === "string" ? body.productType : undefined,
        vendor: typeof body.vendor === "string" ? body.vendor : undefined,
        status:
          body.status === "ACTIVE" ||
          body.status === "DRAFT" ||
          body.status === "ARCHIVED"
            ? body.status
            : "ACTIVE",
        price: typeof body.price === "string" ? body.price : undefined,
        compareAtPrice:
          typeof body.compareAtPrice === "string"
            ? body.compareAtPrice
            : undefined,
        sku: typeof body.sku === "string" ? body.sku : undefined,
        inventoryPolicy:
          body.inventoryPolicy === "CONTINUE" || body.inventoryPolicy === "DENY"
            ? body.inventoryPolicy
            : undefined,
        trackInventory: Boolean(body.trackInventory),
        inventoryQuantity:
          typeof body.inventoryQuantity === "number"
            ? body.inventoryQuantity
            : null,
        locationId:
          typeof body.locationId === "string" ? body.locationId : null,
        publish: body.publish !== false,
        imageResourceUrls: Array.isArray(body.imageResourceUrls)
          ? body.imageResourceUrls.filter(
              (url): url is string => typeof url === "string",
            )
          : typeof body.imageResourceUrl === "string"
            ? [body.imageResourceUrl]
            : [],
        metafields: Array.isArray(body.metafields)
          ? body.metafields.filter(
              (item): item is {
                namespace: string;
                key: string;
                type: string;
                value: string;
              } =>
                !!item &&
                typeof item === "object" &&
                typeof (item as { namespace?: unknown }).namespace === "string" &&
                typeof (item as { key?: unknown }).key === "string" &&
                typeof (item as { type?: unknown }).type === "string" &&
                typeof (item as { value?: unknown }).value === "string",
            )
          : [],
      });

      if (!result.productId) {
        return NextResponse.json(
          { error: result.errors[0] ?? "Create failed", errors: result.errors },
          { status: 400 },
        );
      }

      return NextResponse.json({
        productId: result.productId,
        title: result.title,
        handle: result.handle,
        warnings: result.errors,
      });
    }

    const formData = await request.formData();
    const fallback = `/merchant/products/new`;
    const parsed = parseProductCreateFromFormData(
      formData,
      definitions,
      fallback,
    );

    const result = await createShopProduct(shop, {
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

    if (respondJson) {
      if (!result.productId) {
        return NextResponse.json(
          { error: result.errors[0] ?? "Create failed", errors: result.errors },
          { status: 400 },
        );
      }
      return NextResponse.json({
        productId: result.productId,
        title: result.title,
        handle: result.handle,
        warnings: result.errors,
      });
    }

    if (!result.productId) {
      return redirectAfterForm(request, parsed.returnTo, {
        error: result.errors[0] ?? "Create failed",
      });
    }

    if (result.errors.length > 0) {
      return redirectAfterForm(request, `/merchant/products`, {
        saved: "1",
        created: result.title ?? "1",
        error: `Created with warnings: ${result.errors[0]}`,
      });
    }

    return redirectAfterForm(request, `/merchant/products`, {
      saved: "1",
      created: result.title ?? "1",
    });
  } catch (error) {
    if (isShopApiAccessError(error)) {
      if (respondJson) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      }
      return redirectAfterForm(request, `/merchant/products/new`, {
        error: error.message,
      });
    }
    throw error;
  }
}
