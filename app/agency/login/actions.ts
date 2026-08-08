"use server";

import { redirect } from "next/navigation";
import { setAgencySessionCookie } from "@/lib/agency/cookies";
import { authenticateAgencyUser } from "@/lib/db/agency-users";

export interface LoginFormState {
  error?: string;
}

export async function loginAction(
  _prevState: LoginFormState | null,
  formData: FormData,
): Promise<LoginFormState | null> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password required" };
  }

  let user;
  try {
    user = await authenticateAgencyUser(email, password);
  } catch (error) {
    console.error("[agency/login] authenticate failed", error);
    return { error: "Login unavailable — check DATABASE_URL and SESSION_SECRET" };
  }

  if (!user) {
    return {
      error:
        "Invalid email or password. Use AGENCY_ADMIN_EMAIL / AGENCY_ADMIN_PASSWORD from .env.local (seed runs only when agency_users is empty).",
    };
  }

  try {
    await setAgencySessionCookie(user.id);
  } catch (error) {
    console.error("[agency/login] session cookie failed", error);
    return { error: "SESSION_SECRET missing or invalid in .env.local" };
  }

  redirect("/agency/dashboard");
}
