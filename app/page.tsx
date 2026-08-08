import Link from "next/link";
import { redirect } from "next/navigation";
import {
  embeddedAppPath,
  isEmbeddedAdminRequest,
} from "@/lib/shopify/session";

interface HomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Home({ searchParams }: HomeProps) {
  const query = await searchParams;

  if (isEmbeddedAdminRequest(query)) {
    redirect(embeddedAppPath("/app", query));
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-10">
      <h1 className="text-3xl font-semibold">Products &amp; Inventory Manager</h1>
      <p className="text-muted-foreground">
        Multi-tenant Shopify app. Install a store via OAuth, then manage it from
        the embedded app or agency dashboard.
      </p>
      <div className="flex flex-col gap-2 text-sm">
        <Link className="underline" href="/agency/login">
          Agency dashboard
        </Link>
        <Link className="underline" href="/login">
          Merchant login
        </Link>
        <Link className="underline" href="/app">
          Merchant app shell
        </Link>
        <span>
          Install:{" "}
          <code>/api/auth?shop=teststore-for-app-3p7rdjc3.myshopify.com</code>
        </span>
      </div>
    </main>
  );
}
