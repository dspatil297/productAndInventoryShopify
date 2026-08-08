import { NextResponse } from "next/server";
import { z } from "zod";
import { appRedirectUrl } from "@/lib/agency/app-url";
import { setAgencySessionCookie } from "@/lib/agency/cookies";
import { authenticateAgencyUser } from "@/lib/db/agency-users";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  }

  const user = await authenticateAgencyUser(
    parsed.data.email,
    parsed.data.password,
  );
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  try {
    await setAgencySessionCookie(user.id);
  } catch {
    return NextResponse.json(
      { error: "SESSION_SECRET missing or invalid" },
      { status: 500 },
    );
  }

  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(appRedirectUrl(request, "/agency/dashboard"));
  }

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
  });
}
