import { cookies } from "next/headers";
import {
  AGENCY_SESSION_COOKIE,
  AGENCY_SESSION_MAX_AGE_SECONDS,
  createAgencySessionToken,
} from "@/lib/agency/session";

export async function setAgencySessionCookie(userId: string): Promise<void> {
  const token = createAgencySessionToken(userId);
  const cookieStore = await cookies();
  cookieStore.set(AGENCY_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AGENCY_SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearAgencySessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(AGENCY_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
