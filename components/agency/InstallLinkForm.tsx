import { agencyButtonClass } from "@/components/agency/styles";

export const InstallLinkForm = () => {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Install link</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter a store domain and click Start install — works without JavaScript.
      </p>
      <form action="/api/auth" method="GET" className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          name="shop"
          type="text"
          required
          placeholder="client-store or client-store.myshopify.com"
          className={agencyButtonClass.input}
        />
        <button type="submit" className={agencyButtonClass.primary}>
          Start install
        </button>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">
        Use a <strong>dev store</strong> in your Partner org. Domain only — not a full URL.
        Set <code className="rounded bg-muted px-1">SHOPIFY_APP_URL</code> to your tunnel in .env.local.
      </p>
    </div>
  );
};
