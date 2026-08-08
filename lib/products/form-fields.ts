import {
  metafieldColumnKey,
  type MetafieldUpdateInput,
} from "@/lib/metafields/types";
import { isUnsupportedMetafieldType } from "@/lib/metafields/validators";
import { validateProductImages } from "@/lib/products/image-limits";
import type { MetafieldDefinitionNode } from "@/types/shopify";

export interface ProductCreateFormInput {
  title: string;
  handle: string;
  descriptionHtml: string;
  productType: string;
  vendor: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  templateSuffix: string;
  price: string;
  compareAtPrice: string;
  sku: string;
  inventoryPolicy: "DENY" | "CONTINUE";
  trackInventory: boolean;
  inventoryQuantity: number | null;
  locationId: string;
  publish: boolean;
  metafields: Array<Omit<MetafieldUpdateInput, "ownerId">>;
  images: File[];
  returnTo: string;
}

const ALLOWED_STATUS = new Set(["ACTIVE", "DRAFT", "ARCHIVED"]);

export class ProductCreateFormError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductCreateFormError";
  }
}

export function safeProductReturnTo(
  raw: FormDataEntryValue | null,
  fallback: string,
): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  return raw;
}

export function appendProductFlashParams(
  returnTo: string,
  flash: Record<string, string>,
): string {
  const url = new URL(returnTo, "https://local.invalid");
  for (const [key, value] of Object.entries(flash)) {
    url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}

function readString(raw: FormDataEntryValue | null): string {
  return typeof raw === "string" ? raw.trim() : "";
}

function readInt(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}

export function parseProductCreateFromFormData(
  formData: FormData,
  definitions: MetafieldDefinitionNode[],
  fallbackReturnTo: string,
): ProductCreateFormInput {
  const statusRaw = readString(formData.get("status")).toUpperCase();
  const status = ALLOWED_STATUS.has(statusRaw)
    ? (statusRaw as ProductCreateFormInput["status"])
    : "ACTIVE";

  const policyRaw = readString(formData.get("inventoryPolicy")).toUpperCase();
  const inventoryPolicy =
    policyRaw === "CONTINUE" ? "CONTINUE" : "DENY";

  const metafields: ProductCreateFormInput["metafields"] = [];
  for (const definition of definitions) {
    if (isUnsupportedMetafieldType(definition.type.name)) {
      continue;
    }
    const columnKey = metafieldColumnKey(definition.namespace, definition.key);
    const value = readString(formData.get(`mf[${columnKey}]`));
    if (!value) {
      continue;
    }
    metafields.push({
      namespace: definition.namespace,
      key: definition.key,
      type: definition.type.name,
      value,
    });
  }

  const images: File[] = [];
  for (const entry of formData.getAll("images")) {
    if (entry instanceof File && entry.size > 0 && entry.name) {
      images.push(entry);
    }
  }
  // legacy single field
  const single = formData.get("image");
  if (single instanceof File && single.size > 0 && single.name) {
    images.push(single);
  }

  const imageError = validateProductImages(images);
  if (imageError) {
    throw new ProductCreateFormError(imageError);
  }

  return {
    title: readString(formData.get("title")),
    handle: readString(formData.get("handle")),
    descriptionHtml: readString(formData.get("descriptionHtml")),
    productType: readString(formData.get("productType")),
    vendor: readString(formData.get("vendor")),
    status,
    templateSuffix: readString(formData.get("templateSuffix")),
    price: readString(formData.get("price")),
    compareAtPrice: readString(formData.get("compareAtPrice")),
    sku: readString(formData.get("sku")),
    inventoryPolicy,
    trackInventory: formData.get("trackInventory") === "on" || formData.get("trackInventory") === "true",
    inventoryQuantity: readInt(formData.get("inventoryQuantity")),
    locationId: readString(formData.get("locationId")),
    publish:
      formData.get("publish") === "on" ||
      formData.get("publish") === "true" ||
      formData.get("publish") === "1",
    metafields,
    images,
    returnTo: safeProductReturnTo(formData.get("returnTo"), fallbackReturnTo),
  };
}

export interface ProductEditFormInput {
  productId: string;
  variantId: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  productType: string;
  vendor: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  price: string;
  compareAtPrice: string;
  sku: string;
  inventoryPolicy: "DENY" | "CONTINUE";
  metafields: Array<Omit<MetafieldUpdateInput, "ownerId">>;
  returnTo: string;
  view: "simple" | "preview" | "visual";
  templateSuffix: string;
}

export function parseProductEditFromFormData(
  formData: FormData,
  definitions: MetafieldDefinitionNode[],
  fallbackReturnTo: string,
): ProductEditFormInput {
  const productId = readString(formData.get("productId"));
  if (!productId) {
    throw new ProductCreateFormError("Missing product id");
  }

  const statusRaw = readString(formData.get("status")).toUpperCase();
  const status = ALLOWED_STATUS.has(statusRaw)
    ? (statusRaw as ProductEditFormInput["status"])
    : "ACTIVE";

  const policyRaw = readString(formData.get("inventoryPolicy")).toUpperCase();
  const inventoryPolicy = policyRaw === "CONTINUE" ? "CONTINUE" : "DENY";

  const metafields: ProductEditFormInput["metafields"] = [];
  for (const definition of definitions) {
    if (isUnsupportedMetafieldType(definition.type.name)) {
      continue;
    }
    const columnKey = metafieldColumnKey(definition.namespace, definition.key);
    const value = readString(formData.get(`mf[${columnKey}]`));
    if (!value) {
      continue;
    }
    metafields.push({
      namespace: definition.namespace,
      key: definition.key,
      type: definition.type.name,
      value,
    });
  }

  const viewRaw = readString(formData.get("view")).toLowerCase();
  const view =
    viewRaw === "preview" || viewRaw === "visual" ? viewRaw : "simple";

  return {
    productId,
    variantId: readString(formData.get("variantId")),
    title: readString(formData.get("title")),
    handle: readString(formData.get("handle")),
    descriptionHtml: readString(formData.get("descriptionHtml")),
    productType: readString(formData.get("productType")),
    vendor: readString(formData.get("vendor")),
    status,
    price: readString(formData.get("price")),
    compareAtPrice: readString(formData.get("compareAtPrice")),
    sku: readString(formData.get("sku")),
    inventoryPolicy,
    metafields,
    returnTo: safeProductReturnTo(formData.get("returnTo"), fallbackReturnTo),
    view,
    templateSuffix: readString(formData.get("templateSuffix")),
  };
}
