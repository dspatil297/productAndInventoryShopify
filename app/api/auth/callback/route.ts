import { NextResponse } from "next/server";
import { completeShopifyAuth } from "@/lib/shopify/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    return await completeShopifyAuth(request);
  } catch (error) {
    console.error("OAuth callback failed", { error });
    const message =
      error instanceof Error ? error.message : "OAuth callback failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
