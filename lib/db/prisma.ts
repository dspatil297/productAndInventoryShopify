import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function normalizePgConnectionString(raw: string): {
  connectionString: string;
  ssl: boolean | { rejectUnauthorized: boolean } | undefined;
} {
  try {
    const url = new URL(raw);
    // Neon `channel_binding=require` causes TLS socket drops in node-postgres (`pg`)
    url.searchParams.delete("channel_binding");
    const sslmode = url.searchParams.get("sslmode");
    const isLocal =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1";

    if (!isLocal && (!sslmode || sslmode === "require" || sslmode === "prefer" || sslmode === "verify-ca")) {
      url.searchParams.set("sslmode", "verify-full");
    }

    const useSsl = !isLocal && url.searchParams.get("sslmode") !== "disable";
    return {
      connectionString: url.toString(),
      ssl: useSsl ? { rejectUnauthorized: true } : undefined,
    };
  } catch {
    return { connectionString: raw, ssl: undefined };
  }
}

function createPool(rawConnectionString: string): Pool {
  const { connectionString, ssl } = normalizePgConnectionString(rawConnectionString);
  const pool = new Pool({
    connectionString,
    ssl,
    max: 10,
    connectionTimeoutMillis: 20_000,
    idleTimeoutMillis: 20_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
  pool.on("error", (err) => {
    console.warn("[db] Pool idle client error:", err.message);
  });
  return pool;
}

function createPrismaClient(): PrismaClient {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = globalForPrisma.pool ?? createPool(raw);
  globalForPrisma.pool = pool;

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

function isClientCurrent(client: PrismaClient): boolean {
  // ponytail: after `prisma generate`, HMR keeps global client without new models
  return typeof client.merchantUser?.count === "function";
}

function getPrismaClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing && isClientCurrent(existing)) {
    return existing;
  }

  const created = createPrismaClient();
  globalForPrisma.prisma = created;
  return created;
}

const TRANSIENT_DB_PATTERNS = [
  "Client network socket disconnected",
  "before secure TLS connection was established",
  "Connection terminated unexpectedly",
  "Can't reach database server",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "P1001",
  "P1017",
];

export function isTransientDbError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return TRANSIENT_DB_PATTERNS.some((pattern) => message.includes(pattern));
}

export async function withDbRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
  throw lastError;
}

// Proxy so every access re-checks stale global after schema generate
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
