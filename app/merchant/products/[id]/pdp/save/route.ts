import { NextResponse } from "next/server";
import { z } from "zod";
import { getShopWithConfig } from "@/lib/db/shops";
import { readMetafieldDefinitionsFromConfig } from "@/lib/metafields/config";
import { metafieldColumnKey } from "@/lib/metafields/types";
import {
  MerchantPortalAuthError,
  requireMerchantPortalShopFromRequest,
} from "@/lib/merchant/auth";
import { productGidFromParam } from "@/lib/products/product-gid";
import { getShopProductForEdit } from "@/lib/products/get-product";
import { updateShopProduct } from "@/lib/products/update-product";
import { isUnsupportedMetafieldType } from "@/lib/metafields/validators";

const saveSchema = z.object({
  title: z.string().nullable().optional(),
  descriptionHtml: z.string().nullable().optional(),
  metafields: z
    .array(
      z.object({
        namespace: z.string().min(1),
        key: z.string().min(1),
        type: z.string().min(1),
        value: z.string(),
      }),
    )
    .default([]),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  let shop;
  try {
    shop = await requireMerchantPortalShopFromRequest(request);
  } catch (error) {
    if (error instanceof MerchantPortalAuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }

  const { id } = await context.params;
  const productGid = productGidFromParam(id);
  if (!productGid) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }

  const shopWithConfig = await getShopWithConfig(shop.id);
  const product = await getShopProductForEdit(
    shopWithConfig ?? shop,
    productGid,
  );
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const definitions = readMetafieldDefinitionsFromConfig(
    shopWithConfig?.config,
  );
  const allowed = new Map(
    definitions
      .filter((definition) => !isUnsupportedMetafieldType(definition.type.name))
      .map((definition) => [
        metafieldColumnKey(definition.namespace, definition.key),
        definition.type.name,
      ]),
  );

  const metafields = [];
  for (const item of parsed.data.metafields) {
    const columnKey = metafieldColumnKey(item.namespace, item.key);
    const expectedType = allowed.get(columnKey);
    if (!expectedType) {
      continue;
    }
    metafields.push({
      namespace: item.namespace,
      key: item.key,
      type: expectedType,
      value: item.value,
    });
  }

  const title = parsed.data.title?.trim() || product.title;
  const descriptionHtml =
    parsed.data.descriptionHtml === null ||
    parsed.data.descriptionHtml === undefined
      ? product.descriptionHtml
      : parsed.data.descriptionHtml;

  const result = await updateShopProduct(shopWithConfig ?? shop, {
    productId: product.id,
    title,
    handle: product.handle,
    descriptionHtml,
    productType: product.productType,
    vendor: product.vendor,
    status: product.status,
    variantId: product.variant?.id ?? null,
    price: product.variant?.price,
    compareAtPrice: product.variant?.compareAtPrice,
    sku: product.variant?.sku,
    inventoryPolicy: product.variant?.inventoryPolicy,
    metafields,
  });

  if (!result.productId) {
    return NextResponse.json(
      { error: result.errors[0] ?? "Update failed" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    productId: result.productId,
    warnings: result.errors,
  });
}
