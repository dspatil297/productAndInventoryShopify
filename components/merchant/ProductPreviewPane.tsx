/**
 * Full-bleed proxied PDP with in-page Canva-style editor (no merchant form).
 */
export function ProductPreviewPane({
  productId,
  previewUrl,
  refreshToken = "",
}: {
  productId: string;
  previewUrl: string | null;
  refreshToken?: string;
}) {
  const proxyBase = `/merchant/products/${productId}/pdp`;
  const iframeSrc = previewUrl
    ? `${proxyBase}?bust=${encodeURIComponent(refreshToken || "0")}`
    : null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Edit the live theme in place (blue outlines). If store has a password,
        unlock form appears inside this frame first. Nested shop iframes stripped
        (Shopify blocks framing those).
      </p>
      {iframeSrc ? (
        <iframe
          id="merchant-product-preview-iframe"
          title="Storefront PDP editor"
          src={iframeSrc}
          className="h-[min(85vh,900px)] w-full rounded-xl border border-border bg-background"
          referrerPolicy="no-referrer"
          data-preview-base={proxyBase}
        />
      ) : (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          No storefront URL for this product yet.
        </div>
      )}
    </div>
  );
}
