import { InviteForm } from "./invite-form";
import { PageHeader } from "@/components/app/page-header";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Inviter un membre · LeadPartner" };

export default async function InvitePage() {
  const session = await requireRole(["company_admin"]);
  if (!session.tenant) return null;
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Inviter un membre"
        description="Apporteur, collaborateur interne... Choisissez le rôle adapté."
      />
      <InviteForm tenantId={session.tenant.id} userId={session.user.id} />
    </div>
  );
}
