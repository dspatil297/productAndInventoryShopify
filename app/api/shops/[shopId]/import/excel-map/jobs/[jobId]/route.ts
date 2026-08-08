import { NextResponse } from "next/server";
import { getExcelMapJob } from "@/lib/import/excel-map-jobs";
import {
  isShopApiAccessError,
  requireShopApiAccess,
} from "@/lib/shops/api-access";

interface RouteContext {
  params: Promise<{ shopId: string; jobId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { shopId, jobId } = await context.params;

  try {
    await requireShopApiAccess(request, shopId);
    const job = await getExcelMapJob(jobId, shopId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json(job);
  } catch (error) {
    if (isShopApiAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
