import { cookies } from "next/headers";
import { decrypt, encrypt } from "@/lib/encryption";

const COOKIE_PREFIX = "mop_sf_unlock_";
const MAX_AGE_SEC = 60 * 60 * 12;

function cookieName(shopId: string): string {
  return `${COOKIE_PREFIX}${shopId}`;
}

export async function getStorefrontUnlockCookie(
  shopId: string,
): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(cookieName(shopId))?.value;
  if (!raw) {
    return null;
  }
  try {
    return decrypt(raw);
  } catch {
    return null;
  }
}

export async function setStorefrontUnlockCookie(
  shopId: string,
  shopifyCookieHeader: string,
): Promise<void> {
  const store = await cookies();
  store.set(cookieName(shopId), encrypt(shopifyCookieHeader), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearStorefrontUnlockCookie(shopId: string): Promise<void> {
  const store = await cookies();
  store.delete(cookieName(shopId));
}
