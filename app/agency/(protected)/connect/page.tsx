import { ConnectStoreForm } from "@/components/agency/ConnectStoreForm";
import { OAuthDiagnostics } from "@/components/agency/OAuthDiagnostics";

interface AgencyConnectPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function AgencyConnectPage({
  searchParams,
}: AgencyConnectPageProps) {
  const params = await searchParams;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Connect store</h1>
        <p className="mt-2 text-muted-foreground">
          Enter a dev store myshopify.com domain to start OAuth install.
        </p>
      </div>

      {params.error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {params.error}
        </p>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-6">
        <ConnectStoreForm />
      </div>

      <OAuthDiagnostics />
    </div>
  );
};
