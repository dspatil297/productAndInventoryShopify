import { NextResponse } from "next/server";
import { buildProductImportTemplate } from "@/lib/csv/productImport";
import { readMetafieldDefinitionsFromConfig } from "@/lib/metafields/config";
import {
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
    const definitions = readMetafieldDefinitionsFromConfig(shop.config);
    const csv = buildProductImportTemplate(definitions);
    const filename = `${shop.shopName.replace(/\s+/g, "-").toLowerCase()}-product-import-template.csv`;

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
