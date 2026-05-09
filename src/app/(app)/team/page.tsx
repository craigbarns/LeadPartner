import Link from "next/link";
import { PlusCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { ROLE_LABELS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pickOne } from "@/lib/supabase-helpers";
import { formatDate } from "@/lib/utils";
import type { AppRole } from "@/types/database";

export const metadata = { title: "Équipe · LeadPartner" };

export default async function TeamPage() {
  const session = await requireRole(["company_admin", "super_admin"]);
  if (!session.tenant) return null;

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("tenant_members")
    .select("id, role, status, referral_code, created_at, profiles(full_name, email)")
    .eq("tenant_id", session.tenant.id)
    .order("created_at", { ascending: false });

  const { data: invitations } = await supabase
    .from("invitations")
    .select("id, email, role, expires_at, accepted_at, created_at")
    .eq("tenant_id", session.tenant.id)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Équipe & apporteurs"
        description="Gérez vos collaborateurs internes et vos apporteurs externes."
        actions={
          <Button asChild>
            <Link href="/team/invite">
              <PlusCircle className="h-4 w-4" /> Inviter
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Membres</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {members && members.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Ajouté le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => {
                  const profile = pickOne(m.profiles as { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null);
                  return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {profile?.full_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {profile?.email}
                    </TableCell>
                    <TableCell>{ROLE_LABELS[m.role as AppRole]}</TableCell>
                    <TableCell>
                      <Badge variant={m.status === "active" ? "success" : "secondary"}>
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {m.referral_code ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(m.created_at)}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6">
              <EmptyState
                icon={Users}
                title="Aucun membre"
                description="Invitez votre équipe et vos premiers apporteurs."
              />
            </div>
          )}
        </CardContent>
      </Card>

      {invitations && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Invitations en attente</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Expire le</TableHead>
                  <TableHead>Envoyée le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>{ROLE_LABELS[inv.role as AppRole]}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(inv.expires_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(inv.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
