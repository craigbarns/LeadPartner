import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteAcceptForm } from "./accept-form";
import { ROLE_LABELS } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { pickOne } from "@/lib/supabase-helpers";
import { formatDate } from "@/lib/utils";
import type { AppRole } from "@/types/database";

export const metadata = { title: "Invitation · LeadPartner" };

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createServiceClient();
  const { data: invitation } = await supabase
    .from("invitations")
    .select("id, tenant_id, email, role, expires_at, accepted_at, tenants(name, primary_color)")
    .eq("token", token)
    .maybeSingle();

  if (!invitation) notFound();

  const tenant = pickOne(invitation.tenants as { name: string; primary_color: string | null } | { name: string; primary_color: string | null }[] | null);
  const expired = new Date(invitation.expires_at) < new Date();
  const accepted = !!invitation.accepted_at;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Invitation à rejoindre {tenant?.name}</CardTitle>
          <CardDescription>
            Rôle proposé : <strong>{ROLE_LABELS[invitation.role as AppRole]}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accepted ? (
            <p className="text-sm text-muted-foreground">
              Cette invitation a déjà été acceptée. Connectez-vous pour accéder à votre
              espace.
            </p>
          ) : expired ? (
            <p className="text-sm text-destructive">
              Cette invitation a expiré le {formatDate(invitation.expires_at)}. Demandez à
              l&apos;administrateur d&apos;en générer une nouvelle.
            </p>
          ) : (
            <InviteAcceptForm
              tenantId={invitation.tenant_id}
              email={invitation.email}
              role={invitation.role as Exclude<AppRole, "super_admin">}
              token={token}
              invitationId={invitation.id}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
