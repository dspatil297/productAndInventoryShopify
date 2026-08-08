import { createHmac } from "node:crypto";

/**
 * ponytail: self-check for Phase 9 session payload shape (no DB).
 * Fails if session tokens omit userId or accept handoff as session.
 */
function sign(data, secret) {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function makeToken(payload, secret) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, secret)}`;
}

function parseSession(token, secret) {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (signature !== sign(data, secret)) return null;
  const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  if (payload.kind !== "session" || !payload.userId || !payload.shopId) {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export async function runMerchantAuthSelfCheck() {
  const secret = "phase9-selfcheck-secret";
  const now = Math.floor(Date.now() / 1000);

  const good = makeToken(
    {
      shopId: "shop-1",
      userId: "user-1",
      kind: "session",
      exp: now + 3600,
    },
    secret,
  );
  const parsed = parseSession(good, secret);
  if (!parsed || parsed.userId !== "user-1" || parsed.shopId !== "shop-1") {
    throw new Error("session token with userId should verify");
  }

  const legacy = makeToken(
    {
      shopId: "shop-1",
      kind: "session",
      exp: now + 3600,
    },
    secret,
  );
  if (parseSession(legacy, secret)) {
    throw new Error("legacy session without userId must be rejected");
  }

  const handoff = makeToken(
    {
      shopId: "shop-1",
      kind: "handoff",
      exp: now + 300,
    },
    secret,
  );
  if (parseSession(handoff, secret)) {
    throw new Error("handoff token must not parse as session");
  }
}
