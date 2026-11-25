import { NextResponse } from "next/server";
import {
  AiImportConfigError,
  AiImportMapError,
} from "@/lib/import/ai-map-columns";
import {
  startExcelMapJob,
  waitForExcelMapJob,
} from "@/lib/import/excel-map-jobs";
import {
  ensureImportPromptPack,
  readStoredImportPromptPack,
} from "@/lib/import/sync-prompt-pack";
import { readMetafieldDefinitionsFromConfig } from "@/lib/metafields/config";
import { appFormRedirect } from "@/lib/agency/app-url";
import {
  appendProductFlashParams,
  safeProductReturnTo,
} from "@/lib/products/form-fields";
import {
  isShopApiAccessError,
  requireShopApiAccess,
} from "@/lib/shops/api-access";

interface RouteContext {
  params: Promise<{ shopId: string }>;
}

const MAX_EXCEL_BYTES = 8 * 1024 * 1024;

function redirectAfterForm(
  request: Request,
  returnTo: string,
  flash: Record<string, string>,
): Response {
  const target = appendProductFlashParams(returnTo, flash);
  return appFormRedirect(request, target);
}

function returnToWithJob(returnTo: string, jobId: string): string {
  const url = new URL(returnTo, "https://local.invalid");
  url.searchParams.set("job", jobId);
  return `${url.pathname}${url.search}`;
}

export async function POST(request: Request, context: RouteContext) {
  const { shopId } = await context.params;
  const isJson =
    request.headers.get("accept")?.includes("application/json") ||
    request.headers.get("x-json-response") === "1";

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    if (isJson) {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }
    return redirectAfterForm(request, "/merchant/import?tab=ai", {
      error: "Invalid form upload",
    });
  }

  const returnTo = safeProductReturnTo(
    formData.get("returnTo"),
    "/merchant/import?tab=ai",
  );
  const systemPromptOverride = String(formData.get("systemPrompt") ?? "").trim();

  try {
    const shop = await requireShopApiAccess(request, shopId);
    const definitions = readMetafieldDefinitionsFromConfig(shop.config);

    const storedPack = readStoredImportPromptPack(shop.config?.settings);
    const pack = await ensureImportPromptPack(shop.id, definitions, storedPack);

    const file = formData.get("file");
    const isFileLike = Boolean(
      file &&
      typeof file === "object" &&
      "size" in file &&
      typeof (file as Blob).size === "number" &&
      (file as Blob).size > 0 &&
      typeof (file as Blob).arrayBuffer === "function",
    );
    if (!isFileLike) {
      if (isJson) {
        return NextResponse.json(
          { error: "Choose a spreadsheet file (.xlsx or .csv)" },
          { status: 400 },
        );
      }
      return redirectAfterForm(request, returnTo, {
        error: "Choose a spreadsheet file (.xlsx or .csv)",
      });
    }

    const uploadBlob = file as Blob;
    if (uploadBlob.size > MAX_EXCEL_BYTES) {
      if (isJson) {
        return NextResponse.json(
          { error: "Spreadsheet file too large (max 8 MB)" },
          { status: 400 },
        );
      }
      return redirectAfterForm(request, returnTo, {
        error: "Spreadsheet file too large (max 8 MB)",
      });
    }

    const fileName =
      "name" in uploadBlob && typeof (uploadBlob as File).name === "string"
        ? (uploadBlob as File).name
        : "spreadsheet.xlsx";
    const buffer = Buffer.from(await uploadBlob.arrayBuffer());
    const jobId = startExcelMapJob({
      shopId: shop.id,
      buffer,
      fileName,
      pack,
      systemPrompt: systemPromptOverride || undefined,
    });

    if (isJson) {
      const quickResult = await waitForExcelMapJob(jobId, shop.id, 3_000);
      return NextResponse.json({
        ok: true,
        jobId,
        job: quickResult,
      });
    }

    const finished = await waitForExcelMapJob(jobId, shop.id, 4_000);

    const flash: Record<string, string> = {};
    if (finished?.status === "error") {
      flash.error = finished.error ?? "Excel preview failed";
    } else if (
      finished?.status !== "preview_ready" &&
      finished?.status !== "done"
    ) {
      flash.processing = "1";
    }

    return redirectAfterForm(request, returnToWithJob(returnTo, jobId), flash);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Excel transform failed";

    if (isJson) {
      const status = isShopApiAccessError(error) ? 401 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    if (isShopApiAccessError(error)) {
      return redirectAfterForm(request, returnTo, { error: message });
    }
    if (error instanceof AiImportConfigError) {
      return redirectAfterForm(request, returnTo, { error: message });
    }
    if (error instanceof AiImportMapError) {
      return redirectAfterForm(request, returnTo, { error: message });
    }
    if (error instanceof Error && error.message.includes("Excel")) {
      return redirectAfterForm(request, returnTo, { error: message });
    }
    if (error instanceof Error) {
      return redirectAfterForm(request, returnTo, { error: message });
    }
    throw error;
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  url.pathname = "/merchant/import";
  url.searchParams.set("tab", "ai");
  return NextResponse.redirect(url);
}

export async function HEAD(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
