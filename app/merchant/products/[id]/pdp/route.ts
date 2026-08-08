import { getShopWithConfig } from "@/lib/db/shops";
import { getAppBaseUrlFromRequest } from "@/lib/agency/app-url";
import { readMetafieldDefinitionsFromConfig } from "@/lib/metafields/config";
import { metafieldColumnKey } from "@/lib/metafields/types";
import { isUnsupportedMetafieldType } from "@/lib/metafields/validators";
import {
  MerchantPortalAuthError,
  requireMerchantPortalShopFromRequest,
} from "@/lib/merchant/auth";
import { getShopProductForEdit } from "@/lib/products/get-product";
import {
  productGidFromParam,
  productNumericId,
} from "@/lib/products/product-gid";
import {
  fetchStorefrontHtml,
  isStorefrontPasswordPage,
  rewriteStorefrontHtml,
  storefrontHostnameAllowed,
  storefrontPasswordUnlockPage,
  type PdpEditorPayload,
} from "@/lib/products/pdp-proxy";
import {
  clearStorefrontUnlockCookie,
  getStorefrontUnlockCookie,
} from "@/lib/products/storefront-unlock-cookie";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "frame-ancestors 'self'",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}

function errorPage(message: string, status: number): Response {
  return htmlResponse(
    `<!doctype html><html><body style="font:14px system-ui;padding:24px;color:#444">
    <p><strong>PDP preview</strong></p>
    <p>${message}</p>
  </body></html>`,
    status,
  );
}

export async function GET(request: Request, context: RouteContext) {
  let shop;
  try {
    shop = await requireMerchantPortalShopFromRequest(request);
  } catch (error) {
    if (error instanceof MerchantPortalAuthError) {
      return errorPage("Sign in required.", 401);
    }
    throw error;
  }

  const { id } = await context.params;
  const productGid = productGidFromParam(id);
  if (!productGid) {
    return errorPage("Invalid product id.", 400);
  }

  const shopWithConfig = await getShopWithConfig(shop.id);
  const product = await getShopProductForEdit(
    shopWithConfig ?? shop,
    productGid,
  );
  if (!product) {
    return errorPage("Product not found.", 404);
  }
  if (!product.previewUrl) {
    return errorPage(
      "No storefront URL for this product (publish / set handle first).",
      404,
    );
  }

  const extraHosts = [
    product.onlineStoreUrl,
    product.onlineStorePreviewUrl,
  ].filter((value): value is string => Boolean(value));

  if (
    !storefrontHostnameAllowed(
      product.previewUrl,
      shop.shopDomain,
      extraHosts,
    )
  ) {
    return errorPage("Storefront host not allowed for this shop.", 403);
  }

  const definitions = readMetafieldDefinitionsFromConfig(
    shopWithConfig?.config,
  );
  const numericId = productNumericId(product.id);
  const appOrigin = getAppBaseUrlFromRequest(request);
  const unlockError = new URL(request.url).searchParams.get("unlock_error");
  const unlockAction = `${appOrigin}/merchant/products/${numericId}/pdp/unlock`;

  const editorPayload: PdpEditorPayload = {
    productId: product.id,
    numericId,
    saveUrl: `${appOrigin}/merchant/products/${numericId}/pdp/save`,
    simpleFormsUrl: `${appOrigin}/merchant/products/${numericId}?view=simple`,
    title: product.title,
    handle: product.handle,
    descriptionHtml: product.descriptionHtml,
    status: product.status,
    price: product.variant?.price ?? "",
    metafields: definitions
      .filter((definition) => !isUnsupportedMetafieldType(definition.type.name))
      .map((definition) => {
        const columnKey = metafieldColumnKey(
          definition.namespace,
          definition.key,
        );
        return {
          namespace: definition.namespace,
          key: definition.key,
          type: definition.type.name,
          name: definition.name,
          value: product.metafieldValues[columnKey] ?? "",
        };
      }),
  };

  try {
    const cookieHeader = await getStorefrontUnlockCookie(shop.id);
    const { html, finalUrl } = await fetchStorefrontHtml(product.previewUrl, {
      cookieHeader,
    });

    if (
      !storefrontHostnameAllowed(finalUrl.toString(), shop.shopDomain, [
        ...extraHosts,
        product.previewUrl,
      ])
    ) {
      return errorPage("Storefront redirect host not allowed.", 403);
    }

    if (isStorefrontPasswordPage(html, finalUrl)) {
      if (cookieHeader) {
        await clearStorefrontUnlockCookie(shop.id);
      }
      return htmlResponse(
        storefrontPasswordUnlockPage({
          unlockAction,
          error: unlockError ?? undefined,
          liveUrl: product.previewUrl,
        }),
      );
    }

    const body = rewriteStorefrontHtml(html, finalUrl, {
      appOrigin,
      editorPayload,
    });
    return htmlResponse(body);
  } catch (error) {
    return errorPage(
      error instanceof Error ? error.message : "Failed to load storefront PDP",
      502,
    );
  }
}
