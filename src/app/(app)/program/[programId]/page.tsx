import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgramSettingsForm } from "../program-form";
import { PageHeader } from "@/components/app/page-header";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Programme · LeadPartner" };

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const session = await requireRole(["company_admin"]);
  if (!session.tenant) return null;

  const supabase = await createClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, name, description, terms, public_signup_enabled, slug")
    .eq("id", programId)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();

  if (!program) notFound();

  const publicUrl = program.public_signup_enabled
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/p/${session.tenant.slug}?program=${encodeURIComponent(program.slug)}`
    : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/program"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Tous les programmes
      </Link>
      <PageHeader
        title={program.name}
        description="Contenu public, inscription et conditions."
      />
      {publicUrl && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Page publique (ce programme)</CardTitle>
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
          </CardContent>
        </Card>
      )}
      <ProgramSettingsForm
        tenantId={session.tenant.id}
        program={program}
        publicSlug={session.tenant.slug}
      />
    </div>
  );
}
