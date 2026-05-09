import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app/sidebar";
import { Header } from "@/components/app/header";
import { getSession } from "@/lib/auth";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "super_admin") redirect("/dashboard");
  return (
    <div className="flex">
      <Sidebar role="super_admin" tenantName="LeadPartner Admin" primaryColor="#0F172A" />
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <Header
          email={session.user.email}
          fullName={session.profile.full_name}
          role={session.role}
        />
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-screen-2xl w-full">{children}</main>
      </div>
    </div>
  );
}
