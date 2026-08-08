import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { requireEnv } from "@/lib/env";

export const MERCHANT_STORE_PICK_COOKIE = "merchant_store_pick";
export const MERCHANT_STORE_PICK_MAX_AGE_SECONDS = 60 * 10;

interface StorePickPayload {
  kind: "store_pick";
  userIds: string[];
  returnTo: string;
  exp: number;
}

function signPayload(data: string): string {
  return createHmac("sha256", requireEnv("SESSION_SECRET"))
    .update(data)
    .digest("base64url");
}

export function createMerchantStorePickToken(
  userIds: string[],
  returnTo: string,
): string {
  const payload: StorePickPayload = {
    kind: "store_pick",
    userIds,
    returnTo,
    exp: Math.floor(Date.now() / 1000) + MERCHANT_STORE_PICK_MAX_AGE_SECONDS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${signPayload(data)}`;
}

export function verifyMerchantStorePickToken(
  token: string | undefined | null,
): StorePickPayload | null {
  if (!token) {
    return null;
  }

  const dotIndex = token.lastIndexOf(".");
  if (dotIndex <= 0) {
    return null;
  }

  const data = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  const expected = signPayload(data);

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  let payload: StorePickPayload;
  try {
    payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8"),
    ) as StorePickPayload;
  } catch {
    return null;
  }

  if (
    payload.kind !== "store_pick" ||
    !Array.isArray(payload.userIds) ||
    payload.userIds.length === 0 ||
    payload.exp < Math.floor(Date.now() / 1000)
  ) {
    return null;
  }

  return payload;
}

export async function setMerchantStorePickCookie(
  userIds: string[],
  returnTo: string,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(
    MERCHANT_STORE_PICK_COOKIE,
    createMerchantStorePickToken(userIds, returnTo),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MERCHANT_STORE_PICK_MAX_AGE_SECONDS,
    },
  );
}

export async function clearMerchantStorePickCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(MERCHANT_STORE_PICK_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getMerchantStorePickPayload(): Promise<StorePickPayload | null> {
  const cookieStore = await cookies();
  return verifyMerchantStorePickToken(
    cookieStore.get(MERCHANT_STORE_PICK_COOKIE)?.value,
  );
}
