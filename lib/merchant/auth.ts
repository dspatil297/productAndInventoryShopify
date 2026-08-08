import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Shop } from "@/generated/prisma/client";
import { getMerchantUserById } from "@/lib/db/merchant-users";
import { getShopWithConfig } from "@/lib/db/shops";
import { requireEnv } from "@/lib/env";

export const MERCHANT_PORTAL_SESSION_COOKIE = "merchant_portal_session";
export const MERCHANT_PORTAL_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
export const MERCHANT_PORTAL_HANDOFF_MAX_AGE_SECONDS = 60 * 60;

export interface MerchantPortalSessionPayload {
  userId: string;
  shopId: string;
  exp: number;
}

interface SignedPortalPayload {
  shopId: string;
  exp: number;
  kind: "session" | "handoff";
  userId?: string;
}

function signPayload(data: string): string {
  return createHmac("sha256", requireEnv("SESSION_SECRET"))
    .update(data)
    .digest("base64url");
}

export function createMerchantPortalSessionToken(
  shopId: string,
  userId: string,
): string {
  return createSignedPortalToken(
    shopId,
    "session",
    MERCHANT_PORTAL_SESSION_MAX_AGE_SECONDS,
    userId,
  );
}

export function createMerchantPortalHandoffToken(shopId: string): string {
  return createSignedPortalToken(
    shopId,
    "handoff",
    MERCHANT_PORTAL_HANDOFF_MAX_AGE_SECONDS,
  );
}

function createSignedPortalToken(
  shopId: string,
  kind: SignedPortalPayload["kind"],
  maxAgeSeconds: number,
  userId?: string,
): string {
  const payload: SignedPortalPayload = {
    shopId,
    kind,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
    ...(userId ? { userId } : {}),
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${signPayload(data)}`;
}

function verifySignedPortalToken(
  token: string | undefined | null,
  kind: SignedPortalPayload["kind"],
): SignedPortalPayload | null {
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

  let payload: SignedPortalPayload;
  try {
    payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8"),
    ) as SignedPortalPayload;
  } catch {
    return null;
  }

  if (payload.kind && payload.kind !== kind) {
    return null;
  }
  if (!payload.kind && kind !== "session") {
    return null;
  }

  if (!payload.shopId || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  if (kind === "session" && !payload.userId) {
    return null;
  }

  return payload;
}

export function verifyMerchantPortalHandoffToken(
  token: string | undefined | null,
): SignedPortalPayload | null {
  return verifySignedPortalToken(token, "handoff");
}

export function verifyMerchantPortalSessionToken(
  token: string | undefined | null,
): MerchantPortalSessionPayload | null {
  const payload = verifySignedPortalToken(token, "session");
  if (!payload?.userId) {
    return null;
  }

  return {
    userId: payload.userId,
    shopId: payload.shopId,
    exp: payload.exp,
  };
}

export class MerchantPortalAuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "MerchantPortalAuthError";
  }
}

export function getMerchantPortalSessionFromRequest(
  request: Request,
): MerchantPortalSessionPayload | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${MERCHANT_PORTAL_SESSION_COOKIE}=([^;]+)`),
  );
  const token = match?.[1] ? decodeURIComponent(match[1]) : null;
  return verifyMerchantPortalSessionToken(token);
}

export async function getMerchantPortalShop(): Promise<Shop | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(MERCHANT_PORTAL_SESSION_COOKIE)?.value;
  const payload = verifyMerchantPortalSessionToken(token);
  if (!payload) {
    return null;
  }

  const user = await getMerchantUserById(payload.userId);
  if (!user || user.shopId !== payload.shopId) {
    return null;
  }

  const shop = await getShopWithConfig(payload.shopId);
  if (!shop?.isActive) {
    return null;
  }

  return shop;
}

export async function getMerchantPortalUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(MERCHANT_PORTAL_SESSION_COOKIE)?.value;
  const payload = verifyMerchantPortalSessionToken(token);
  if (!payload) {
    return null;
  }

  const user = await getMerchantUserById(payload.userId);
  if (!user || user.shopId !== payload.shopId) {
    return null;
  }

  return user;
}

export async function requireMerchantPortalShop(): Promise<Shop> {
  const shop = await getMerchantPortalShop();
  if (!shop) {
    throw new MerchantPortalAuthError();
  }
  return shop;
}

export async function requireMerchantPortalShopFromRequest(
  request: Request,
): Promise<Shop> {
  const payload = getMerchantPortalSessionFromRequest(request);
  if (!payload) {
    throw new MerchantPortalAuthError();
  }

  const user = await getMerchantUserById(payload.userId);
  if (!user || user.shopId !== payload.shopId) {
    throw new MerchantPortalAuthError();
  }

  const shop = await getShopWithConfig(payload.shopId);
  if (!shop?.isActive) {
    throw new MerchantPortalAuthError();
  }

  return shop;
}
