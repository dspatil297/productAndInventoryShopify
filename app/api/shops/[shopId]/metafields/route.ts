import { NextResponse } from "next/server";
import { z } from "zod";
import { listShopMetafields } from "@/lib/metafields/list-metafields";
import { setShopMetafields } from "@/lib/metafields/set-metafields";
import {
  ShopApiAccessError,
  isShopApiAccessError,
  requireShopApiAccess,
} from "@/lib/shops/api-access";

interface RouteContext {
  params: Promise<{ shopId: string }>;
}

const querySchema = z.object({
  first: z.coerce.number().int().min(1).max(50).optional(),
  after: z.string().optional(),
  search: z.string().optional(),
});

const saveSchema = z.object({
  updates: z
    .array(
      z.object({
        ownerId: z.string().min(1),
        namespace: z.string().min(1),
        key: z.string().min(1),
        type: z.string().min(1),
        value: z.string(),
      }),
    )
    .min(1)
    .max(250),
});

export async function GET(request: Request, context: RouteContext) {
  const { shopId } = await context.params;

  try {
    const shop = await requireShopApiAccess(request, shopId);
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      first: url.searchParams.get("first") ?? undefined,
      after: url.searchParams.get("after") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters" },
        { status: 400 },
      );
    }

    const result = await listShopMetafields(shop, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (isShopApiAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { shopId } = await context.params;

  try {
    const shop = await requireShopApiAccess(request, shopId);
    const body = await request.json();
    const parsed = saveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const result = await setShopMetafields(shop, parsed.data.updates);
    return NextResponse.json(result);
  } catch (error) {
    if (isShopApiAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
