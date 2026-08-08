import { NextResponse } from "next/server";
import {
  AgencyAuthError,
  requireAgencySessionUserFromRequest,
} from "@/lib/agency/auth";
import {
  sumProductCounts,
  toAgencyStoreSummary,
} from "@/lib/agency/stores";
import { listShopsWithConfig } from "@/lib/db/shops";

export async function GET(request: Request) {
  try {
    await requireAgencySessionUserFromRequest(request);
  } catch (error) {
    if (error instanceof AgencyAuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }

  const shops = await listShopsWithConfig();
  const stores = shops.map(toAgencyStoreSummary);

  return NextResponse.json({
    stores,
    stats: {
      total: stores.length,
      active: stores.filter((store) => store.isActive).length,
      inactive: stores.filter((store) => !store.isActive).length,
      totalProducts: sumProductCounts(stores),
    },
  });
}
