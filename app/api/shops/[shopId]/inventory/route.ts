import { NextResponse } from "next/server";
import { z } from "zod";
import { listShopInventory } from "@/lib/inventory/list-inventory";
import {
  ShopApiAccessError,
  isShopApiAccessError,
  requireShopApiAccess,
} from "@/lib/shops/api-access";

interface RouteContext {
  params: Promise<{ shopId: string }>;
}

const querySchema = z.object({
  locationId: z.string().optional(),
  first: z.coerce.number().int().min(1).max(50).optional(),
  after: z.string().optional(),
  search: z.string().optional(),
});

export async function GET(request: Request, context: RouteContext) {
  const { shopId } = await context.params;

  try {
    const shop = await requireShopApiAccess(request, shopId);
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      locationId: url.searchParams.get("locationId") ?? undefined,
      first: url.searchParams.get("first") ?? undefined,
      after: url.searchParams.get("after") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters" },
        { status: 400 },
      );
    }

    const result = await listShopInventory(shop, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (isShopApiAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
