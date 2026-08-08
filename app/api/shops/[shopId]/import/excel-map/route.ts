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
  const formData = await request.formData();
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
    if (!(file instanceof File) || file.size === 0) {
      return redirectAfterForm(request, returnTo, {
        error: "Choose an Excel file (.xlsx)",
      });
    }
    if (file.size > MAX_EXCEL_BYTES) {
      return redirectAfterForm(request, returnTo, {
        error: "Excel file too large (max 8 MB)",
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const jobId = startExcelMapJob({
      shopId: shop.id,
      buffer,
      fileName: file.name,
      pack,
      systemPrompt: systemPromptOverride || undefined,
    });

    const finished = await waitForExcelMapJob(jobId, shop.id, 180_000);
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
    if (isShopApiAccessError(error)) {
      return redirectAfterForm(request, returnTo, { error: error.message });
    }
    if (error instanceof AiImportConfigError) {
      return redirectAfterForm(request, returnTo, { error: error.message });
    }
    if (error instanceof AiImportMapError) {
      return redirectAfterForm(request, returnTo, { error: error.message });
    }
    if (error instanceof Error && error.message.includes("Excel")) {
      return redirectAfterForm(request, returnTo, { error: error.message });
    }
    if (error instanceof Error) {
      return redirectAfterForm(request, returnTo, { error: error.message });
    }
    throw error;
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function HEAD(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
