import { createRequire } from "node:module";
import type { MerchantUser, Shop } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const require = createRequire(import.meta.url);
const bcrypt = require("bcrypt") as typeof import("bcrypt");

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

export type MerchantUserWithShop = MerchantUser & {
  shop: Pick<Shop, "id" | "shopName" | "shopDomain" | "isActive">;
};

export function normalizeMerchantEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertMerchantPassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}

export async function createMerchantUser(input: {
  shopId: string;
  email: string;
  password: string;
  name: string;
  role?: string;
  /** Reuse hash when linking another store with same password */
  passwordHash?: string;
}): Promise<MerchantUser> {
  if (!input.passwordHash) {
    const passwordError = assertMerchantPassword(input.password);
    if (passwordError) {
      throw new Error(passwordError);
    }
  }

  return prisma.merchantUser.create({
    data: {
      shopId: input.shopId,
      email: normalizeMerchantEmail(input.email),
      passwordHash:
        input.passwordHash ??
        (await bcrypt.hash(input.password, BCRYPT_ROUNDS)),
      name: input.name.trim() || "Merchant",
      role: input.role ?? "owner",
    },
  });
}

export async function findMerchantUsersByEmail(
  email: string,
): Promise<MerchantUser[]> {
  return prisma.merchantUser.findMany({
    where: {
      email: {
        equals: normalizeMerchantEmail(email),
        mode: "insensitive",
      },
    },
  });
}

export async function findMerchantUserByShopAndEmail(
  shopId: string,
  email: string,
): Promise<MerchantUser | null> {
  return prisma.merchantUser.findUnique({
    where: {
      shopId_email: {
        shopId,
        email: normalizeMerchantEmail(email),
      },
    },
  });
}

export async function countMerchantUsersForShop(shopId: string): Promise<number> {
  return prisma.merchantUser.count({ where: { shopId } });
}

/** All shop memberships where email+password match (multi-store). */
export async function authenticateMerchantUsers(
  email: string,
  password: string,
): Promise<MerchantUser[]> {
  const candidates = await findMerchantUsersByEmail(email);
  if (candidates.length === 0) {
    return [];
  }

  const matched: MerchantUser[] = [];
  for (const user of candidates) {
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (isValid) {
      matched.push(user);
    }
  }
  return matched;
}

export async function getMerchantUserById(
  userId: string,
): Promise<MerchantUser | null> {
  return prisma.merchantUser.findUnique({ where: { id: userId } });
}

export async function getMerchantUsersByIdsWithShop(
  userIds: string[],
): Promise<MerchantUserWithShop[]> {
  if (userIds.length === 0) {
    return [];
  }

  return prisma.merchantUser.findMany({
    where: { id: { in: userIds } },
    include: {
      shop: {
        select: {
          id: true,
          shopName: true,
          shopDomain: true,
          isActive: true,
        },
      },
    },
    orderBy: { shop: { shopName: "asc" } },
  });
}

export async function listMerchantStoresForEmail(
  email: string,
): Promise<MerchantUserWithShop[]> {
  return prisma.merchantUser.findMany({
    where: {
      email: {
        equals: normalizeMerchantEmail(email),
        mode: "insensitive",
      },
    },
    include: {
      shop: {
        select: {
          id: true,
          shopName: true,
          shopDomain: true,
          isActive: true,
        },
      },
    },
    orderBy: { shop: { shopName: "asc" } },
  });
}

/**
 * Link second+ store: email already exists elsewhere → same password required.
 * Returns existing row if already on this shop.
 */
export async function registerOrLinkMerchantUser(input: {
  shopId: string;
  email: string;
  password: string;
  name: string;
}): Promise<{ user: MerchantUser; linked: boolean }> {
  const normalizedEmail = normalizeMerchantEmail(input.email);
  const onThisShop = await findMerchantUserByShopAndEmail(
    input.shopId,
    normalizedEmail,
  );
  if (onThisShop) {
    throw new Error("An account with this email already exists for this store — sign in instead");
  }

  const elsewhere = await findMerchantUsersByEmail(normalizedEmail);
  if (elsewhere.length === 0) {
    const user = await createMerchantUser({
      shopId: input.shopId,
      email: normalizedEmail,
      password: input.password,
      name: input.name,
    });
    return { user, linked: false };
  }

  const passwordOk = await bcrypt.compare(
    input.password,
    elsewhere[0].passwordHash,
  );
  if (!passwordOk) {
    throw new Error(
      "This email already has a dashboard login — use the same password to link this store",
    );
  }

  const user = await createMerchantUser({
    shopId: input.shopId,
    email: normalizedEmail,
    password: input.password,
    passwordHash: elsewhere[0].passwordHash,
    name: input.name.trim() || elsewhere[0].name,
  });
  return { user, linked: true };
}
