import { createHmac, timingSafeEqual } from "node:crypto";
import { requireEnv } from "@/lib/env";

export const AGENCY_SESSION_COOKIE = "agency_session";
export const AGENCY_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

interface SessionPayload {
  userId: string;
  exp: number;
}

function signPayload(data: string): string {
  return createHmac("sha256", requireEnv("SESSION_SECRET"))
    .update(data)
    .digest("base64url");
}

export function createAgencySessionToken(userId: string): string {
  const payload: SessionPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + AGENCY_SESSION_MAX_AGE_SECONDS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${signPayload(data)}`;
}

export function verifyAgencySessionToken(
  token: string | undefined | null,
): SessionPayload | null {
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

  let payload: SessionPayload;
  try {
    payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8"),
    ) as SessionPayload;
  } catch {
    return null;
  }

  if (!payload.userId || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}
