import { NextResponse } from "next/server";
import { buildInventoryCsv } from "@/lib/inventory/export-csv";
import { listShopInventory } from "@/lib/inventory/list-inventory";
import {
  ShopApiAccessError,
  isShopApiAccessError,
  requireShopApiAccess,
} from "@/lib/shops/api-access";

interface RouteContext {
  params: Promise<{ shopId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { shopId } = await context.params;

  try {
    const shop = await requireShopApiAccess(request, shopId);
    const url = new URL(request.url);
    const locationId = url.searchParams.get("locationId") ?? undefined;
    const search = url.searchParams.get("search") ?? undefined;

    const data = await listShopInventory(shop, {
      locationId,
      search,
      first: 50,
    });

    const csv = buildInventoryCsv(data.rows, data.locationName || "location");
    const filename = `${shop.shopName.replace(/\s+/g, "-").toLowerCase()}-inventory.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (isShopApiAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
