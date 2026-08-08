import { getAppBaseUrlFromHeaders } from "@/lib/agency/app-url";
import { getOAuthCallbackUrl } from "@/lib/env";
import { headers } from "next/headers";

export const OAuthDiagnostics = async () => {
  const headerList = await headers();
  const headerMap = new Headers();
  for (const name of ["host", "x-forwarded-host", "x-forwarded-proto"]) {
    const value = headerList.get(name);
    if (value) {
      headerMap.set(name, value);
    }
  }

  const request = new Request("https://placeholder", { headers: headerMap });
  const appBaseUrl = await getAppBaseUrlFromHeaders();
  const callbackUrl = getOAuthCallbackUrl(request);
  const apiKey = process.env.SHOPIFY_API_KEY ?? "";
  const apiKeyHint =
    apiKey.length >= 8
      ? `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`
      : "missing";

  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm">
      <h2 className="font-medium">OAuth diagnostics</h2>
      <ul className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
        <li>App URL: {appBaseUrl}</li>
        <li>Callback: {callbackUrl}</li>
        <li>API key: {apiKeyHint}</li>
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Partner Dashboard → App setup → URLs must match Callback exactly. Set{" "}
        <code className="rounded bg-muted px-1">SHOPIFY_APP_URL</code> in
        .env.local to the tunnel URL from <code className="rounded bg-muted px-1">shopify app dev</code>, then restart.
        Store must be a <strong>dev store</strong> in your Partner org (or allowed for your app distribution).
      </p>
    </div>
  );
};
