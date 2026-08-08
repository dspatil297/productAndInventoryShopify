import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AgencyAuthError,
  requireAgencySessionUserFromRequest,
} from "@/lib/agency/auth";
import { toAgencyStoreSummary } from "@/lib/agency/stores";
import {
  disconnectShop,
  getShopWithConfig,
} from "@/lib/db/shops";

interface RouteContext {
  params: Promise<{ shopId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
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

  return NextResponse.json({ store: toAgencyStoreSummary(shop) });
}

const disconnectSchema = z.object({
  purgeToken: z.boolean().optional(),
});

export async function DELETE(request: Request, context: RouteContext) {
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

  let purgeToken = false;
  try {
    const body = await request.json();
    const parsed = disconnectSchema.safeParse(body);
    purgeToken = parsed.success ? (parsed.data.purgeToken ?? false) : false;
  } catch {
    purgeToken = false;
  }

  await disconnectShop(shopId, { purgeToken });
  return NextResponse.json({ ok: true });
}
