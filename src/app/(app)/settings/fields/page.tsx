import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Champs personnalisés · LeadPartner" };

export default async function FieldsPage() {
  const session = await requireRole(["company_admin"]);
  if (!session.tenant) return null;

  const supabase = await createClient();
  const { data: fields } = await supabase
    .from("opportunity_fields")
    .select("*")
    .eq("tenant_id", session.tenant.id)
    .order("sort_order");

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Champs personnalisés"
        description={`Champs spécifiques préchargés pour votre secteur (${session.tenant.industry}).`}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Champs actifs</CardTitle>
          <CardDescription>
            Ces champs apparaissent sur le formulaire de déclaration d&apos;opportunité.
            L&apos;édition complète est prévue dans une prochaine itération.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fields && fields.length ? (
            <div className="space-y-2">
              {fields.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{f.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Clé : <code>{f.key}</code> · Type : {f.type}
                      {f.required && " · Requis"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun champ personnalisé défini.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
