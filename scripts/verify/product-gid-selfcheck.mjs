import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getRoot } from "./lib.mjs";

/** Mirrors lib/products/product-gid.ts + preview URL pick order (no TS loader). */
function productNumericId(gid) {
  const match = /^gid:\/\/shopify\/Product\/(\d+)$/.exec(gid.trim());
  if (!match) {
    throw new Error(`Invalid product GID: ${gid}`);
  }
  return match[1];
}

function productGidFromParam(raw) {
  const value = decodeURIComponent(String(raw).trim());
  if (!value) {
    return null;
  }
  if (/^gid:\/\/shopify\/Product\/\d+$/.test(value)) {
    return value;
  }
  if (/^\d+$/.test(value)) {
    return `gid://shopify/Product/${value}`;
  }
  return null;
}

function productEditPath(gid, view, templateSuffix, options) {
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

function resolveProductPreviewUrl(input) {
  return (
    input.onlineStorePreviewUrl ||
    input.onlineStoreUrl ||
    (input.handle?.trim()
      ? `https://${input.shopDomain}/products/${encodeURIComponent(input.handle.trim())}`
      : null)
  );
}

export async function runProductGidSelfCheck() {
  assert.ok(
    existsSync(join(getRoot(), "lib/products/product-gid.ts")),
    "product-gid.ts missing",
  );
  assert.ok(
    existsSync(join(getRoot(), "lib/products/get-product.ts")),
    "get-product.ts missing",
  );

  assert.equal(productNumericId("gid://shopify/Product/12345"), "12345");
  assert.equal(productGidFromParam("12345"), "gid://shopify/Product/12345");
  assert.equal(
    productGidFromParam("gid://shopify/Product/99"),
    "gid://shopify/Product/99",
  );
  assert.equal(productGidFromParam("nope"), null);
  assert.equal(
    productEditPath("gid://shopify/Product/7", "preview"),
    "/merchant/products/7?view=visual",
  );
  assert.equal(
    productEditPath("gid://shopify/Product/7", "simple"),
    "/merchant/products/7",
  );
  assert.equal(
    productEditPath("gid://shopify/Product/7", "visual", "classic"),
    "/merchant/products/7?view=visual&suffix=classic",
  );

  assert.equal(
    resolveProductPreviewUrl({
      onlineStorePreviewUrl: "https://shop.test/preview",
      onlineStoreUrl: "https://shop.test/products/x",
      shopDomain: "shop.test",
      handle: "x",
    }),
    "https://shop.test/preview",
  );
  assert.equal(
    resolveProductPreviewUrl({
      onlineStorePreviewUrl: null,
      onlineStoreUrl: null,
      shopDomain: "cool.myshopify.com",
      handle: "blue-mug",
    }),
    "https://cool.myshopify.com/products/blue-mug",
  );

  assert.equal(
    storefrontHostnameAllowed(
      "https://cool.myshopify.com/products/x",
      "cool.myshopify.com",
    ),
    true,
  );
  assert.equal(
    storefrontHostnameAllowed(
      "https://evil.example/products/x",
      "cool.myshopify.com",
    ),
    false,
  );
  assert.equal(
    storefrontHostnameAllowed(
      "https://brand.com/products/x",
      "cool.myshopify.com",
      ["https://brand.com/products/x"],
    ),
    true,
  );

  const rewritten = rewriteStorefrontHtml(
    "<html><head><meta http-equiv=\"Content-Security-Policy\" content=\"frame-ancestors 'none'\"><title>t</title></head><body>ok</body></html>",
    new URL("https://cool.myshopify.com/products/x"),
    {
      appOrigin: "https://app.test",
      editorPayload: {
        productId: "gid://shopify/Product/1",
        numericId: "1",
        saveUrl: "https://app.test/merchant/products/1/pdp/save",
        simpleFormsUrl: "https://app.test/merchant/products/1?view=simple",
        title: "Mug",
        handle: "mug",
        descriptionHtml: "<p>Hi</p>",
        status: "ACTIVE",
        price: "10",
        metafields: [],
      },
    },
  );
  assert.ok(rewritten.includes('<base href="https://cool.myshopify.com/">'));
  assert.ok(!/frame-ancestors\s+'none'/i.test(rewritten));
  assert.ok(rewritten.includes("mop-pdp-editor-payload"));
  assert.ok(rewritten.includes("https://app.test/product-pdp-editor.js"));
}

function storefrontHostnameAllowed(targetUrl, shopDomain, extraHosts = []) {
  let hostname;
  try {
    hostname = new URL(targetUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  const shopHost = shopDomain.toLowerCase().replace(/^https?:\/\//, "");
  if (hostname === shopHost) {
    return true;
  }
  const allowed = new Set(
    [shopHost, ...extraHosts]
      .map((host) => {
        try {
          return host.includes("://")
            ? new URL(host).hostname.toLowerCase()
            : host.toLowerCase();
        } catch {
          return host.toLowerCase();
        }
      })
      .filter(Boolean),
  );
  return allowed.has(hostname);
}

function rewriteStorefrontHtml(html, canonicalUrl, options) {
  const baseHref = `${canonicalUrl.origin}/`;
  const baseTag = `<base href="${baseHref}">`;
  let next = html.replace(
    /<meta\s+[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
    "",
  );
  if (/<head[^>]*>/i.test(next)) {
    next = next.replace(/<head[^>]*>/i, (open) => `${open}${baseTag}`);
  } else {
    next = `${baseTag}${next}`;
  }
  if (!options) {
    return next;
  }
  const inject = `<script type="application/json" id="mop-pdp-editor-payload">{}</script><script src="${options.appOrigin}/product-pdp-editor.js" defer></script>`;
  if (/<\/body>/i.test(next)) {
    return next.replace(/<\/body>/i, `${inject}</body>`);
  }
  return `${next}${inject}`;
}
