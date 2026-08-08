import { redirect } from "next/navigation";
import { embeddedAppPath } from "@/lib/shopify/session";

interface EmbeddedToolRedirectProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProductsRedirect({
  searchParams,
}: EmbeddedToolRedirectProps) {
  const query = await searchParams;
  redirect(embeddedAppPath("/app", query));
}
