import { createRequire } from "node:module";
import type { AgencyUser } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const require = createRequire(import.meta.url);
const bcrypt = require("bcrypt") as typeof import("bcrypt");

function normalizeAgencyEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function ensureSeedAgencyUser(): Promise<void> {
  const count = await prisma.agencyUser.count();
  if (count > 0) {
    return;
  }

  const email = process.env.AGENCY_ADMIN_EMAIL?.trim();
  const password = process.env.AGENCY_ADMIN_PASSWORD;
  if (!email || !password) {
    return;
  }

  await prisma.agencyUser.create({
    data: {
      email: normalizeAgencyEmail(email),
      passwordHash: await bcrypt.hash(password, 12),
      name: "Admin",
    },
  });
}

export async function authenticateAgencyUser(
  email: string,
  password: string,
): Promise<AgencyUser | null> {
  await ensureSeedAgencyUser();

  const normalizedEmail = normalizeAgencyEmail(email);
  const user = await prisma.agencyUser.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
  });
  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  return user;
}

export async function getAgencyUserById(
  userId: string,
): Promise<AgencyUser | null> {
  return prisma.agencyUser.findUnique({ where: { id: userId } });
}
