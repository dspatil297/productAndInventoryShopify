import { notFound } from "next/navigation";
import { updateMerchantProductAction } from "@/app/merchant/products/[id]/actions";
import { ProductEditForm } from "@/components/merchant/ProductEditForm";
import { ProductEditShell } from "@/components/merchant/ProductEditShell";
import { VisualProductFlow } from "@/components/merchant/VisualProductFlow";
import { getShopWithConfig } from "@/lib/db/shops";
import { readLocationsFromConfig } from "@/lib/inventory/locations";
import { readMetafieldDefinitionsFromConfig } from "@/lib/metafields/config";
import { metafieldColumnKey } from "@/lib/metafields/types";
import { requireMerchantPortalShop } from "@/lib/merchant/auth";
import { readProductTypesFromConfig } from "@/lib/products/config";
import { getShopProductForEdit } from "@/lib/products/get-product";
import {
  productEditPath,
  productGidFromParam,
} from "@/lib/products/product-gid";
import {
  readSyncedThemeTemplates,
  resolveVisualTemplateSuffix,
} from "@/lib/products/theme-templates";

interface MerchantEditProductPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function MerchantEditProductPage({
  params,
  searchParams,
}: MerchantEditProductPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const productGid = productGidFromParam(id);
  if (!productGid) {
    notFound();
  }

  const shop = await requireMerchantPortalShop();
  const shopWithConfig = await getShopWithConfig(shop.id);
  const product = await getShopProductForEdit(
    shopWithConfig ?? shop,
    productGid,
  );
  if (!product) {
    notFound();
  }

  const definitions = readMetafieldDefinitionsFromConfig(
    shopWithConfig?.config,
  );
  const productTypes = readProductTypesFromConfig(shopWithConfig?.config);
  const locations = readLocationsFromConfig(shopWithConfig?.config);
  const themeTemplates = readSyncedThemeTemplates(shopWithConfig?.config);
  const viewRaw = firstParam(query.view)?.toLowerCase();
  const view =
    viewRaw === "visual" || viewRaw === "preview" ? "visual" : "simple";
  const suffixParam =
    firstParam(query.suffix) ?? firstParam(query.template);
  const forcePicker = firstParam(query.pick) === "1";
  const selectedSuffix =
    view === "visual"
      ? resolveVisualTemplateSuffix({
          urlSuffix: suffixParam,
          productTemplateSuffix: product.templateSuffix,
          themeTemplates,
          forcePicker,
          isEdit: true,
        })
      : null;
  const saved = firstParam(query.saved);
  const error = firstParam(query.error);
  const synced = firstParam(query.synced);
  const templatesCount = firstParam(query.templates);
  const returnTo = productEditPath(
    product.id,
    view === "visual" ? "visual" : "simple",
    selectedSuffix ?? undefined,
  );
  const visualPick = productEditPath(product.id, "visual", undefined, {
    pickTemplate: true,
  });
  const visualFill = productEditPath(
    product.id,
    "visual",
    selectedSuffix ?? "",
  );

  const metafieldValues: Record<string, string> = {};
  for (const definition of definitions) {
    const columnKey = metafieldColumnKey(definition.namespace, definition.key);
    metafieldValues[columnKey] = product.metafieldValues[columnKey] ?? "";
  }

  return (
    <ProductEditShell
      view={view}
      simpleHref={productEditPath(product.id, "simple")}
      visualHref={visualPick}
      visualSlot={
        <VisualProductFlow
          mode="edit"
          shopName={shop.shopName}
          shopScope={shop.scope}
          selectedSuffix={selectedSuffix}
          pickHref={visualPick}
          fillBaseHref={visualFill}
          simpleHref={productEditPath(product.id, "simple")}
          syncReturnTo={visualFill}
          themeTemplates={themeTemplates}
          action={updateMerchantProductAction}
          productTypes={productTypes}
          locations={locations}
          definitions={definitions}
          productId={product.id}
          variantId={product.variant?.id}
          values={{
            title: product.title,
            handle: product.handle,
            descriptionHtml: product.descriptionHtml,
            productType: product.productType,
            vendor: product.vendor,
            price: product.variant?.price ?? "",
            compareAtPrice: product.variant?.compareAtPrice ?? "",
            sku: product.variant?.sku ?? "",
            status: product.status,
            inventoryPolicy: product.variant?.inventoryPolicy ?? "DENY",
            trackInventory: true,
            inventoryQuantity: null,
            locationId:
              locations.find((location) => location.isActive)?.id ?? "",
            publish: product.status === "ACTIVE",
            metafieldValues,
          }}
          flash={{
            saved,
            error,
            synced,
            templates: templatesCount,
          }}
        />
      }
    >
      <ProductEditForm
        shopName={shop.shopName}
        product={product}
        productTypes={productTypes}
        definitions={definitions}
        returnTo={returnTo}
        flash={{ saved, error }}
      />
    </ProductEditShell>
  );
}
