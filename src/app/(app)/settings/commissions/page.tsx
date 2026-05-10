import { CommissionRulesEditor } from "./rules-editor";
import { PageHeader } from "@/components/app/page-header";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Règles de commission · LeadPartner" };

export default async function CommissionRulesPage() {
  const session = await requireRole(["company_admin", "super_admin"]);
  if (!session.tenant) return null;

  const supabase = await createClient();
  const [{ data: rules }, { data: programs }] = await Promise.all([
    supabase
      .from("commission_rules")
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("programs")
      .select("id, name, slug")
      .eq("tenant_id", session.tenant.id)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Règles de commission"
        description="Règles globales ou par programme : l’opportunité doit être liée au même programme pour appliquer la règle spécifique."
      />
      <CommissionRulesEditor
        tenantId={session.tenant.id}
        initialRules={rules ?? []}
        programs={programs ?? []}
      />
    </div>
  );
}
