import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  MerchantSessionError,
  buildSessionTokenBounceUrl,
  isDocumentRequest,
  requestFromHeaders,
  resolveMerchantShop,
  searchParamsToUrlSearchParams,
} from "@/lib/shopify/session";

export async function requireMerchantShopFromPage(
  pathname: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const headerList = await headers();
  const request = requestFromHeaders(headerList);
  const urlParams = searchParamsToUrlSearchParams(searchParams);

  try {
    return await resolveMerchantShop(request, searchParams);
  } catch (error) {
    if (!(error instanceof MerchantSessionError)) {
      throw error;
    }

    if (error.code === "shop_not_found") {
      const shopDomain = urlParams.get("shop");
      if (shopDomain) {
        redirect(`/app/install?shop=${encodeURIComponent(shopDomain)}`);
      }
    }

    if (
      isDocumentRequest(request) &&
      (error.code === "missing_token" || error.code === "invalid_token")
    ) {
      redirect(buildSessionTokenBounceUrl(pathname, urlParams));
    }

    throw error;
  }
}
