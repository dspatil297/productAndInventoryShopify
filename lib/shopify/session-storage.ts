import { Session } from "@shopify/shopify-api";
import { prisma } from "@/lib/db/prisma";
import { decrypt, encrypt } from "@/lib/encryption";

interface SessionStorageAdapter {
  storeSession(session: Session): Promise<boolean>;
  loadSession(id: string): Promise<Session | undefined>;
  deleteSession(id: string): Promise<boolean>;
  deleteSessions(ids: string[]): Promise<boolean>;
  findSessionsByShop(shop: string): Promise<Session[]>;
}

function toShopifySession(row: {
  id: string;
  shop: string;
  state: string;
  isOnline: boolean;
  scope: string | null;
  expires: Date | null;
  accessToken: string | null;
}): Session {
  return new Session({
    id: row.id,
    shop: row.shop,
    state: row.state,
    isOnline: row.isOnline,
    scope: row.scope ?? undefined,
    expires: row.expires ?? undefined,
    accessToken: row.accessToken ? decrypt(row.accessToken) : undefined,
  });
}

export const prismaSessionStorage: SessionStorageAdapter = {
  async storeSession(session: Session): Promise<boolean> {
    await prisma.shopifySession.upsert({
      where: { id: session.id },
      create: {
        id: session.id,
        shop: session.shop,
        state: session.state,
        isOnline: session.isOnline,
        scope: session.scope ?? null,
        expires: session.expires ?? null,
        accessToken: session.accessToken ? encrypt(session.accessToken) : null,
        userId: session.onlineAccessInfo?.associated_user?.id?.toString() ?? null,
      },
      update: {
        shop: session.shop,
        state: session.state,
        isOnline: session.isOnline,
        scope: session.scope ?? null,
        expires: session.expires ?? null,
        accessToken: session.accessToken ? encrypt(session.accessToken) : null,
        userId: session.onlineAccessInfo?.associated_user?.id?.toString() ?? null,
      },
    });
    return true;
  },

  async loadSession(id: string): Promise<Session | undefined> {
    const row = await prisma.shopifySession.findUnique({ where: { id } });
    if (!row) {
      return undefined;
    }
    return toShopifySession(row);
  },

  async deleteSession(id: string): Promise<boolean> {
    try {
      await prisma.shopifySession.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },

  async deleteSessions(ids: string[]): Promise<boolean> {
    await prisma.shopifySession.deleteMany({ where: { id: { in: ids } } });
    return true;
  },

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const rows = await prisma.shopifySession.findMany({ where: { shop } });
    return rows.map(toShopifySession);
  },
};
