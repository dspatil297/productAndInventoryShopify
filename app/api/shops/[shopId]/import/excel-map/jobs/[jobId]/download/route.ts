import { NextResponse } from "next/server";
import { getExcelMapJobDownload } from "@/lib/import/excel-map-jobs";
import {
  isShopApiAccessError,
  requireShopApiAccess,
} from "@/lib/shops/api-access";

interface RouteContext {
  params: Promise<{ shopId: string; jobId: string }>;
}

function contentDispositionAttachment(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]+/g, "_") || "mapped-import.csv";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(request: Request, context: RouteContext) {
  const { shopId, jobId } = await context.params;

  try {
    await requireShopApiAccess(request, shopId);
    const download = await getExcelMapJobDownload(jobId, shopId);
    if (!download) {
      return NextResponse.json({ error: "Download not ready" }, { status: 404 });
    }

    return new NextResponse(download.csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": contentDispositionAttachment(download.fileName),
      },
    });
  } catch (error) {
    if (isShopApiAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
