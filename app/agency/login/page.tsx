import { AgencyLoginForm } from "@/components/agency/AgencyLoginForm";

export default function AgencyLoginPage() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-xl border border-border bg-card p-8">
        <h1 className="text-2xl font-semibold">Agency login</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to manage client stores.
        </p>
        <div className="mt-6">
          <AgencyLoginForm />
        </div>
      </div>
    </main>
  );
}
