/**
 * Storefront CSP is `frame-ancestors 'none'` — cannot iframe shop domain directly.
 * Proxy HTML on our origin so merchant PDP panel can frame exact theme output.
 * Inject in-page editor so merchants edit storefront like Canva → sync metafields.
 */

const CSP_META_RE =
  /<meta\s+[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi;
const CSP_HEADER_IN_META_RE =
  /content=["'][^"']*frame-ancestors[^"']*["']/gi;
const IFRAME_RE = /<iframe\b[^>]*>[\s\S]*?<\/iframe>|<iframe\b[^>]*\/?>/gi;
const FRAME_RE = /<frame\b[^>]*>[\s\S]*?<\/frame>|<frame\b[^>]*\/?>/gi;

export interface PdpEditorMetafield {
  namespace: string;
  key: string;
  type: string;
  name: string;
  value: string;
}

export interface PdpEditorPayload {
  productId: string;
  numericId: string;
  saveUrl: string;
  simpleFormsUrl: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  status: string;
  price: string;
  metafields: PdpEditorMetafield[];
}

export function storefrontHostnameAllowed(
  targetUrl: string,
  shopDomain: string,
  extraHosts: string[] = [],
): boolean {
  let hostname: string;
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

/** Password / Coming soon wall — server fetch has no browser unlock cookie. */
export function isStorefrontPasswordPage(html: string, finalUrl: URL): boolean {
  const path = finalUrl.pathname.toLowerCase();
  if (path === "/password" || path.startsWith("/password")) {
    return true;
  }
  const lower = html.toLowerCase();
  if (!lower.includes("storefront_password") && !lower.includes('name="password"')) {
    return false;
  }
  return (
    lower.includes("form_type") ||
    lower.includes("enter using password") ||
    lower.includes("storefront password") ||
    lower.includes("/password")
  );
}

function collectSetCookies(response: Response): string[] {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function cookieHeaderFromSetCookie(setCookies: string[]): string {
  return setCookies
    .map((line) => line.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

export async function unlockStorefrontPassword(
  shopDomain: string,
  password: string,
): Promise<string> {
  const body = new URLSearchParams();
  body.set("form_type", "storefront_password");
  body.set("utf8", "✓");
  body.set("password", password);

  const response = await fetch(`https://${shopDomain}/password`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html,application/xhtml+xml",
      "User-Agent":
        "Mozilla/5.0 (compatible; MerchantOpsPDPPreview/1.0; +https://firefist.co.in)",
    },
    body,
    cache: "no-store",
  });

  const cookieHeader = cookieHeaderFromSetCookie(collectSetCookies(response));
  if (!cookieHeader) {
    throw new Error("Wrong password or store did not set unlock cookie");
  }

  // 302/303 is success; 200 often means password form again (wrong)
  if (response.status === 200) {
    const html = await response.text();
    if (isStorefrontPasswordPage(html, new URL(response.url || `https://${shopDomain}/password`))) {
      throw new Error("Wrong storefront password");
    }
  }

  return cookieHeader;
}

export function rewriteStorefrontHtml(
  html: string,
  canonicalUrl: URL,
  options?: {
    appOrigin: string;
    editorPayload: PdpEditorPayload;
  },
): string {
  const baseHref = `${canonicalUrl.origin}/`;
  const baseTag = `<base href="${baseHref}">`;
  let next = html.replace(CSP_META_RE, "");
  next = next.replace(CSP_HEADER_IN_META_RE, 'content=""');
  // Nested shop iframes → frame-ancestors 'none' console noise / blank chrome
  next = next.replace(IFRAME_RE, "<!-- mop: nested iframe removed -->");
  next = next.replace(FRAME_RE, "<!-- mop: nested frame removed -->");

  if (/<head[^>]*>/i.test(next)) {
    next = next.replace(/<head[^>]*>/i, (open) => `${open}${baseTag}`);
  } else {
    next = `${baseTag}${next}`;
  }

  if (!options) {
    return next;
  }

  const payloadJson = JSON.stringify(options.editorPayload).replace(
    /</g,
    "\\u003c",
  );
  const inject = `
<style id="mop-pdp-editor-css">
  .mop-editable{outline:2px dashed #2563eb!important;outline-offset:2px;cursor:text;min-width:1ch}
  .mop-editable:focus{outline:2px solid #2563eb!important;background:rgba(37,99,235,.06)}
  .mop-editable[data-mop-kind=title]{outline-color:#059669!important}
  #mop-pdp-bar{position:fixed;z-index:2147483646;left:0;right:0;top:0;display:flex;gap:8px;align-items:center;flex-wrap:wrap;
    padding:10px 14px;background:#0f172a;color:#f8fafc;font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)}
  #mop-pdp-bar button,#mop-pdp-bar a{font:inherit;border:0;border-radius:6px;padding:6px 10px;cursor:pointer;text-decoration:none;color:inherit}
  #mop-pdp-bar .mop-primary{background:#2563eb;color:#fff}
  #mop-pdp-bar .mop-ghost{background:#334155;color:#f8fafc}
  #mop-pdp-bar .mop-status{margin-left:auto;opacity:.9}
  #mop-pdp-unplaced{position:fixed;z-index:2147483645;right:12px;bottom:12px;width:min(360px,92vw);max-height:50vh;overflow:auto;
    background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:12px;padding:12px;font:12px/1.4 system-ui,sans-serif;
    box-shadow:0 12px 40px rgba(0,0,0,.2)}
  #mop-pdp-unplaced h3{margin:0 0 8px;font-size:13px}
  #mop-pdp-unplaced label{display:flex;flex-direction:column;gap:4px;margin:0 0 8px}
  #mop-pdp-unplaced input,#mop-pdp-unplaced textarea{font:inherit;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px}
  body{padding-top:52px!important}
</style>
<script type="application/json" id="mop-pdp-editor-payload">${payloadJson}</script>
<script src="${options.appOrigin}/product-pdp-editor.js" defer></script>
`;

  if (/<\/body>/i.test(next)) {
    return next.replace(/<\/body>/i, `${inject}</body>`);
  }
  return `${next}${inject}`;
}

export async function fetchStorefrontHtml(
  previewUrl: string,
  options?: { cookieHeader?: string | null },
): Promise<{ html: string; finalUrl: URL }> {
  const headers: Record<string, string> = {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent":
      "Mozilla/5.0 (compatible; MerchantOpsPDPPreview/1.0; +https://firefist.co.in)",
  };
  if (options?.cookieHeader) {
    headers.Cookie = options.cookieHeader;
  }

  const response = await fetch(previewUrl, {
    redirect: "follow",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Storefront fetch failed (${response.status})`);
  }

  const finalUrl = new URL(response.url);
  const html = await response.text();
  return { html, finalUrl };
}

export function storefrontPasswordUnlockPage(input: {
  unlockAction: string;
  error?: string;
  liveUrl?: string | null;
}): string {
  const error = input.error
    ? `<p style="color:#b91c1c;margin:0 0 12px">${input.error}</p>`
    : "";
  const live = input.liveUrl
    ? `<p style="margin:16px 0 0"><a href="${input.liveUrl}" target="_blank" rel="noreferrer">Open live storefront</a></p>`
    : "";
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Storefront password</title>
<style>
  body{margin:0;font:14px/1.45 system-ui,sans-serif;background:#f8fafc;color:#0f172a;display:grid;place-items:center;min-height:100vh;padding:24px}
  form{width:min(420px,100%);background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;box-shadow:0 10px 30px rgba(15,23,42,.08)}
  h1{font-size:18px;margin:0 0 8px}
  p{margin:0 0 12px;color:#475569}
  input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}
  button{margin-top:12px;width:100%;padding:10px 12px;border:0;border-radius:8px;background:#0f172a;color:#fff;font:inherit;cursor:pointer}
</style></head><body>
<form method="post" action="${input.unlockAction}">
  <h1>Storefront password required</h1>
  <p>Dev stores often lock the Online Store. Enter the same password as <strong>Enter using password</strong> on your shop. Saved for this browser session only.</p>
  ${error}
  <label style="display:block;margin-bottom:6px">Password</label>
  <div style="position:relative">
    <input type="password" id="pw" name="password" required autocomplete="current-password" autofocus style="padding-right: 50px;">
    <button type="button" onclick="const p=document.getElementById('pw'); const t=p.type==='password'; p.type=t?'text':'password'; this.textContent=t?'Hide':'Show'" style="position:absolute; right:6px; top:50%; transform:translateY(-50%); width:auto; padding:4px 8px; margin:0; background:transparent; color:#64748b; font-size:12px; font-weight:600; cursor:pointer;">Show</button>
  </div>
  <button type="submit">Unlock preview</button>
  ${live}
</form>
</body></html>`;
}
