import { OpportunityForm } from "@/components/app/opportunity-form";
import { PageHeader } from "@/components/app/page-header";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Nouvelle opportunité · LeadPartner" };

export default async function NewOpportunityPage() {
  const session = await requireTenant();
  const supabase = await createClient();

  const { data: fields } = await supabase
    .from("opportunity_fields")
    .select("id, key, label, type, options, required, sort_order")
    .eq("tenant_id", session.tenant.id)
    .order("sort_order", { ascending: true });

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Déclarer une opportunité"
        description="Renseignez les informations connues. Vous pourrez compléter plus tard."
      />
      <OpportunityForm
        tenantId={session.tenant.id}
        userId={session.user.id}
        role={session.role}
        customFields={fields ?? []}
      />
    </div>
  );
}
