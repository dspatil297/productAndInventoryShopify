import { cookies } from "next/headers";
import {
  createMerchantPortalSessionToken,
  MERCHANT_PORTAL_SESSION_COOKIE,
  MERCHANT_PORTAL_SESSION_MAX_AGE_SECONDS,
} from "@/lib/merchant/auth";

export async function setMerchantPortalSessionCookie(
  shopId: string,
  userId: string,
): Promise<void> {
  const token = createMerchantPortalSessionToken(shopId, userId);
  const cookieStore = await cookies();
  cookieStore.set(MERCHANT_PORTAL_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MERCHANT_PORTAL_SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearMerchantPortalSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(MERCHANT_PORTAL_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
