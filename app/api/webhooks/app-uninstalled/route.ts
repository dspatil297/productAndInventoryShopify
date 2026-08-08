import {
  deleteShopSessions,
  markShopInactive,
} from "@/lib/db/shops";
import { getShopify } from "@/lib/shopify/shopify";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const shopify = getShopify(request);

  let validated;
  try {
    validated = await shopify.webhooks.validate({
      rawBody,
      rawRequest: request,
    });
  } catch (error) {
    console.error("Webhook validation failed", { error });
    return new Response("Unauthorized", { status: 401 });
  }

  if (!validated.valid) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (validated.topic !== "APP_UNINSTALLED") {
    return new Response("Ignored", { status: 200 });
  }

  const shopDomain = validated.domain;
  if (!shopDomain) {
    return new Response("Missing shop domain", { status: 400 });
  }

  await markShopInactive(shopDomain);
  await deleteShopSessions(shopDomain);

  return new Response("OK", { status: 200 });
}
