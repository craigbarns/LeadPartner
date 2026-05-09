import { BrandingForm } from "./branding-form";
import { PageHeader } from "@/components/app/page-header";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Branding · LeadPartner" };

export default async function BrandingPage() {
  const session = await requireRole(["company_admin", "super_admin"]);
  if (!session.tenant) return null;
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Branding" description="Personnalisez l'identité de votre espace." />
      <BrandingForm tenant={session.tenant} />
    </div>
  );
}
