import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AgencyAuthError,
  requireAgencySessionUserFromRequest,
} from "@/lib/agency/auth";
import { toAgencyStoreSummary } from "@/lib/agency/stores";
import { getShopWithConfig, updateShopConfig } from "@/lib/db/shops";

interface RouteContext {
  params: Promise<{ shopId: string }>;
}

const configSchema = z.object({
  lowStockThreshold: z.number().int().min(0).max(100000).optional(),
  syncFrequency: z.enum(["manual", "hourly", "daily"]).optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAgencySessionUserFromRequest(request);
  } catch (error) {
    if (error instanceof AgencyAuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }

  const { shopId } = await context.params;
  const shop = await getShopWithConfig(shopId);
  if (!shop) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = configSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid config payload" }, { status: 400 });
  }

  const settings =
    parsed.data.syncFrequency !== undefined
      ? { syncFrequency: parsed.data.syncFrequency }
      : undefined;

  const updated = await updateShopConfig(shopId, {
    lowStockThreshold: parsed.data.lowStockThreshold,
    settings,
  });
  if (!updated) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  const refreshed = await getShopWithConfig(shopId);
  if (!refreshed) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  return NextResponse.json({ store: toAgencyStoreSummary(refreshed) });
}
