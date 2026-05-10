import Link from "next/link";
import { ExternalLink, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgramSettingsForm } from "./program-form";
import { CreateProgramForm } from "./create-program-form";
import { PageHeader } from "@/components/app/page-header";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Programmes · LeadPartner" };

export default async function ProgramPage() {
  const session = await requireRole(["company_admin"]);
  if (!session.tenant) return null;

  const supabase = await createClient();
  const { data: programs } = await supabase
    .from("programs")
    .select("id, name, description, terms, public_signup_enabled, slug")
    .eq("tenant_id", session.tenant.id)
    .order("created_at", { ascending: true });

  const list = programs ?? [];
  const first = list[0];

  const defaultPublicUrl =
    first?.public_signup_enabled && first.slug
      ? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/p/${session.tenant.slug}`
      : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Programmes d'apporteurs"
        description="Plusieurs offres (ex. formations) : chaque programme peut avoir ses propres textes, page d'inscription et règles de commission."
      />

      <CreateProgramForm />

      {list.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vos programmes</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border border-t border-border -mx-6 -mb-6 px-0 pb-0">
            {list.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
              >
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{p.slug}</p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/program/${p.id}`}>
                    <Pencil className="h-4 w-4" /> Configurer
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {defaultPublicUrl && first && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Page publique (programme principal)</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href={defaultPublicUrl} target="_blank">
                <ExternalLink className="h-4 w-4" /> Ouvrir
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              URL sans paramètre : premier programme créé. Pour un autre programme, utilisez le lien
              depuis sa fiche de configuration.
            </p>
            <code className="block rounded-md bg-secondary px-3 py-2 text-sm font-mono break-all">
              {defaultPublicUrl}
            </code>
          </CardContent>
        </Card>
      )}

      {first && (
        <ProgramSettingsForm
          tenantId={session.tenant.id}
          program={first}
          publicSlug={session.tenant.slug}
        />
      )}
    </div>
  );
}
