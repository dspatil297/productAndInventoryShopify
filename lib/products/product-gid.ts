const PRODUCT_GID_RE = /^gid:\/\/shopify\/Product\/(\d+)$/;
const NUMERIC_ID_RE = /^\d+$/;

export function productNumericId(gid: string): string {
  const match = PRODUCT_GID_RE.exec(gid.trim());
  if (!match) {
    throw new Error(`Invalid product GID: ${gid}`);
  }
  return match[1];
}

export function productGidFromParam(raw: string): string | null {
  const value = decodeURIComponent(raw.trim());
  if (!value) {
    return null;
  }
  if (PRODUCT_GID_RE.test(value)) {
    return value;
  }
  if (NUMERIC_ID_RE.test(value)) {
    return `gid://shopify/Product/${value}`;
  }
  return null;
}

export function productEditPath(
  gid: string,
  view?: "simple" | "preview" | "visual",
  templateSuffix?: string | null,
  options?: { pickTemplate?: boolean },
): string {
  const id = productNumericId(gid);
  const base = `/merchant/products/${id}`;
  if (view === "visual") {
    const params = new URLSearchParams({ view: "visual" });
    if (templateSuffix !== undefined && templateSuffix !== null) {
      params.set("suffix", templateSuffix);
    }
    if (options?.pickTemplate) {
      params.set("pick", "1");
    }
    return `${base}?${params.toString()}`;
  }
  if (view === "preview") {
    return `${base}?view=visual`;
  }
  return base;
}
