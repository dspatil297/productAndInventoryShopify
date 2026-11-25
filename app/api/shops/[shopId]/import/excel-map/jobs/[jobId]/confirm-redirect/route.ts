import { NextResponse } from "next/server";
import { confirmExcelMapImport } from "@/lib/import/excel-map-jobs";
import { appendProductFlashParams } from "@/lib/products/form-fields";
import { appFormRedirect } from "@/lib/agency/app-url";
import { isShopApiAccessError, requireShopApiAccess } from "@/lib/shops/api-access";

interface RouteContext {
  params: Promise<{ shopId: string; jobId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { shopId, jobId } = await context.params;
  const returnTo = "/merchant/import?tab=ai";

  try {
    await requireShopApiAccess(request, shopId);
    const job = await confirmExcelMapImport(jobId, shopId);

    if (job.flash) {
      const target = appendProductFlashParams(returnTo, job.flash);
      return appFormRedirect(request, target);
    }

    if (job.status === "error") {
      const target = appendProductFlashParams(returnTo, { error: job.error ?? "Import failed" });
      return appFormRedirect(request, target);
    }

    return appFormRedirect(request, appendProductFlashParams(returnTo, {
      saved: String(job.rowCount ?? 0),
    }));
  } catch (error) {
    if (isShopApiAccessError(error)) {
      return appFormRedirect(request, appendProductFlashParams(returnTo, { error: error.message }));
    }
    if (error instanceof Error) {
      return appFormRedirect(request, appendProductFlashParams(returnTo, { error: error.message }));
    }
    throw error;
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
