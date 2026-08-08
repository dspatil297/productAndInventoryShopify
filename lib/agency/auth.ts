import { cookies } from "next/headers";
import type { AgencyUser } from "@/generated/prisma/client";
import { getAgencyUserById } from "@/lib/db/agency-users";
import {
  AGENCY_SESSION_COOKIE,
  verifyAgencySessionToken,
} from "@/lib/agency/session";

export class AgencyAuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AgencyAuthError";
  }
}

export async function getAgencySessionUser(): Promise<AgencyUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AGENCY_SESSION_COOKIE)?.value;
  const payload = verifyAgencySessionToken(token);
  if (!payload) {
    return null;
  }

  return getAgencyUserById(payload.userId);
}

export async function requireAgencySessionUser(): Promise<AgencyUser> {
  const user = await getAgencySessionUser();
  if (!user) {
    throw new AgencyAuthError();
  }
  return user;
}

export function getAgencySessionFromRequest(
  request: Request,
): ReturnType<typeof verifyAgencySessionToken> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${AGENCY_SESSION_COOKIE}=([^;]+)`),
  );
  const token = match?.[1] ? decodeURIComponent(match[1]) : null;
  return verifyAgencySessionToken(token);
}

export async function requireAgencySessionUserFromRequest(
  request: Request,
): Promise<AgencyUser> {
  const payload = getAgencySessionFromRequest(request);
  if (!payload) {
    throw new AgencyAuthError();
  }

  const user = await getAgencyUserById(payload.userId);
  if (!user) {
    throw new AgencyAuthError();
  }

  return user;
}
