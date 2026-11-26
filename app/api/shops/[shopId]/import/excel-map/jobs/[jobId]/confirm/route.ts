import { NextResponse } from "next/server";

import { startExcelMapConfirm } from "@/lib/import/excel-map-jobs";

import {

  isShopApiAccessError,

  requireShopApiAccess,

} from "@/lib/shops/api-access";



interface RouteContext {

  params: Promise<{ shopId: string; jobId: string }>;

}



export async function POST(request: Request, context: RouteContext) {
  const { shopId, jobId } = await context.params;

  try {
    await requireShopApiAccess(request, shopId);
    let resumeFromHandle: string | undefined;
    try {
      const body: unknown = await request.json();
      if (body && typeof body === "object" && "resumeFromHandle" in body) {
        const value = (body as { resumeFromHandle?: unknown }).resumeFromHandle;
        if (typeof value === "string" && value.trim()) {
          resumeFromHandle = value.trim();
        }
      }
    } catch {
      // empty body ok
    }
    const job = await startExcelMapConfirm(jobId, shopId, { resumeFromHandle });
    return NextResponse.json(job);

  } catch (error) {

    if (isShopApiAccessError(error)) {

      return NextResponse.json({ error: error.message }, { status: error.status });

    }

    if (error instanceof Error) {

      return NextResponse.json({ error: error.message }, { status: 400 });

    }

    throw error;

  }

}



export async function GET(): Promise<NextResponse> {

  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });

}

