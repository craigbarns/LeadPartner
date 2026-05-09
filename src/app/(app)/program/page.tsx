import Link from "next/link";
import { Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgramSettingsForm } from "./program-form";
import { PageHeader } from "@/components/app/page-header";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Programme · LeadPartner" };

export default async function ProgramPage() {
  const session = await requireRole(["company_admin"]);
  if (!session.tenant) return null;

  const supabase = await createClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, name, description, terms, public_signup_enabled, slug")
    .eq("tenant_id", session.tenant.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const publicUrl = program?.public_signup_enabled
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/p/${session.tenant.slug}`
    : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Programme d'apporteurs"
        description="Configurez les conditions et la page publique d'inscription."
      />
      {publicUrl && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Page publique d&apos;inscription</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href={publicUrl} target="_blank">
                <ExternalLink className="h-4 w-4" /> Ouvrir
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <code className="block rounded-md bg-secondary px-3 py-2 text-sm font-mono break-all">
              {publicUrl}
            </code>
            <p className="text-xs text-muted-foreground mt-2">
              Partagez cette URL avec les apporteurs potentiels.
            </p>
          </CardContent>
        </Card>
      )}
      {program && (
        <ProgramSettingsForm
          tenantId={session.tenant.id}
          program={program}
          publicSlug={session.tenant.slug}
        />
      )}
    </div>
  );
}
