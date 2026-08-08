"use server";

import { redirect } from "next/navigation";
import {
  authenticateMerchantUsers,
  getMerchantUserById,
  listMerchantStoresForEmail,
  registerOrLinkMerchantUser,
} from "@/lib/db/merchant-users";
import { getShopWithConfig } from "@/lib/db/shops";
import {
  getMerchantPortalUser,
  verifyMerchantPortalHandoffToken,
} from "@/lib/merchant/auth";
import {
  clearMerchantPortalSessionCookie,
  setMerchantPortalSessionCookie,
} from "@/lib/merchant/cookies";
import {
  clearMerchantStorePickCookie,
  getMerchantStorePickPayload,
  setMerchantStorePickCookie,
} from "@/lib/merchant/store-pick";

export interface MerchantAuthFormState {
  error?: string;
}

function safeReturnTo(value: FormDataEntryValue | null): string {
  const raw = String(value ?? "/merchant/products");
  if (raw.startsWith("/merchant") || raw === "/select-store") {
    return raw.startsWith("/merchant") ? raw : "/merchant/products";
  }
  return "/merchant/products";
}

export async function merchantLoginAction(
  _prevState: MerchantAuthFormState | null,
  formData: FormData,
): Promise<MerchantAuthFormState | null> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const returnTo = safeReturnTo(formData.get("return_to"));
  const expectedShopId = String(formData.get("shopId") ?? "").trim() || null;

  if (!email || !password) {
    return { error: "Email and password required" };
  }

  let matches;
  try {
    matches = await authenticateMerchantUsers(email, password);
  } catch (error) {
    console.error("[merchant/login] authenticate failed", error);
    return { error: "Login unavailable — check DATABASE_URL and SESSION_SECRET" };
  }

  if (matches.length === 0) {
    return { error: "Invalid email or password" };
  }

  if (expectedShopId) {
    const forShop = matches.find((user) => user.shopId === expectedShopId);
    if (!forShop) {
      return {
        error:
          "This email is not linked to this store yet — create dashboard login (same password) to link it",
      };
    }
    const shop = await getShopWithConfig(forShop.shopId);
    if (!shop?.isActive) {
      return { error: "Store is not active" };
    }
    try {
      await clearMerchantStorePickCookie();
      await setMerchantPortalSessionCookie(forShop.shopId, forShop.id);
    } catch (error) {
      console.error("[merchant/login] session cookie failed", error);
      return { error: "SESSION_SECRET missing or invalid in .env.local" };
    }
    redirect(returnTo);
  }

  const activeMatches = [];
  for (const user of matches) {
    const shop = await getShopWithConfig(user.shopId);
    if (shop?.isActive) {
      activeMatches.push(user);
    }
  }

  if (activeMatches.length === 0) {
    return { error: "No active stores for this account" };
  }

  if (activeMatches.length === 1) {
    const user = activeMatches[0];
    try {
      await clearMerchantStorePickCookie();
      await setMerchantPortalSessionCookie(user.shopId, user.id);
    } catch (error) {
      console.error("[merchant/login] session cookie failed", error);
      return { error: "SESSION_SECRET missing or invalid in .env.local" };
    }
    redirect(returnTo);
  }

  try {
    await clearMerchantPortalSessionCookie();
    await setMerchantStorePickCookie(
      activeMatches.map((user) => user.id),
      returnTo,
    );
  } catch (error) {
    console.error("[merchant/login] store pick cookie failed", error);
    return { error: "SESSION_SECRET missing or invalid in .env.local" };
  }

  redirect("/select-store");
}

export async function merchantRegisterAction(
  _prevState: MerchantAuthFormState | null,
  formData: FormData,
): Promise<MerchantAuthFormState | null> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const handoff = String(formData.get("handoff") ?? "").trim();
  const returnTo = safeReturnTo(formData.get("return_to"));

  if (!email || !password || !name) {
    return { error: "Name, email, and password required" };
  }

  const handoffPayload = verifyMerchantPortalHandoffToken(handoff);
  if (!handoffPayload) {
    return {
      error:
        "Store proof missing or expired. Open dashboard from Shopify Admin Home first.",
    };
  }

  const shop = await getShopWithConfig(handoffPayload.shopId);
  if (!shop?.isActive) {
    return { error: "Store is not active" };
  }

  let user;
  try {
    const result = await registerOrLinkMerchantUser({
      shopId: shop.id,
      email,
      password,
      name,
    });
    user = result.user;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create account";
    return { error: message };
  }

  try {
    await clearMerchantStorePickCookie();
    await setMerchantPortalSessionCookie(user.shopId, user.id);
  } catch (error) {
    console.error("[merchant/register] session cookie failed", error);
    return { error: "SESSION_SECRET missing or invalid in .env.local" };
  }

  redirect(returnTo);
}

export async function merchantSelectStoreAction(
  _prevState: MerchantAuthFormState | null,
  formData: FormData,
): Promise<MerchantAuthFormState | null> {
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) {
    return { error: "Pick a store" };
  }

  const pick = await getMerchantStorePickPayload();
  if (!pick || !pick.userIds.includes(userId)) {
    return { error: "Store choice expired — sign in again" };
  }

  const user = await getMerchantUserById(userId);
  if (!user || !pick.userIds.includes(user.id)) {
    return { error: "Store not available" };
  }

  const shop = await getShopWithConfig(user.shopId);
  if (!shop?.isActive) {
    return { error: "Store is not active" };
  }

  try {
    await setMerchantPortalSessionCookie(user.shopId, user.id);
    await clearMerchantStorePickCookie();
  } catch (error) {
    console.error("[merchant/select-store] session cookie failed", error);
    return { error: "SESSION_SECRET missing or invalid in .env.local" };
  }

  redirect(pick.returnTo.startsWith("/merchant") ? pick.returnTo : "/merchant/products");
}

/** Logged-in: open picker for other stores linked to same email. */
export async function merchantSwitchStoreAction(): Promise<void> {
  const user = await getMerchantPortalUser();
  if (!user) {
    redirect("/login");
  }

  const siblings = await listMerchantStoresForEmail(user.email);
  const active = siblings.filter((row) => row.shop.isActive);
  if (active.length <= 1) {
    redirect("/merchant/products");
  }

  await setMerchantStorePickCookie(
    active.map((row) => row.id),
    "/merchant/products",
  );
  redirect("/select-store");
}
