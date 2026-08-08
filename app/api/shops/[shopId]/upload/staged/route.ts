import { NextResponse } from "next/server";
import { createStagedUploadTarget } from "@/lib/products/staged-upload";
import {
  isShopApiAccessError,
  requireShopApiAccess,
} from "@/lib/shops/api-access";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ shopId: string }>;
}

const bodySchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  resource: z.enum(["PRODUCT_IMAGE", "FILE"]).optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const { shopId } = await context.params;

  try {
    const shop = await requireShopApiAccess(request, shopId);
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 },
      );
    }

    const target = await createStagedUploadTarget(shop, parsed.data);
    return NextResponse.json(target);
  } catch (error) {
    if (isShopApiAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Staged upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
