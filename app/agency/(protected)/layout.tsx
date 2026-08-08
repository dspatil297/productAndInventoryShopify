import { redirect } from "next/navigation";
import { AgencyNav } from "@/components/agency/AgencyNav";
import { getAgencySessionUser } from "@/lib/agency/auth";

export default async function ProtectedAgencyLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getAgencySessionUser();
  if (!user) {
    redirect("/agency/login");
  }

  return (
    <>
      <AgencyNav userName={user.name} />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </>
  );
}
