import { NextResponse } from "next/server";
import { buildMetafieldsCsv } from "@/lib/metafields/export-csv";
import { listShopMetafields } from "@/lib/metafields/list-metafields";
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
    const search = url.searchParams.get("search") ?? undefined;
    const after = url.searchParams.get("after") ?? undefined;

    const data = await listShopMetafields(shop, {
      first: 50,
      after,
      search,
    });

    const csv = buildMetafieldsCsv(data.rows, data.definitions);
    const filename = `${shop.shopName.replace(/\s+/g, "-").toLowerCase()}-metafields.csv`;

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
