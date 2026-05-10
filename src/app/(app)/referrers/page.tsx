import Link from "next/link";
import { Handshake, PlusCircle } from "lucide-react";
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
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pickOne } from "@/lib/supabase-helpers";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Apporteurs · LeadPartner" };

export default async function ReferrersPage() {
  const session = await requireRole(["company_admin", "collaborator", "super_admin"]);
  if (!session.tenant) return null;
  const supabase = await createClient();

  const { data: referrers } = await supabase
    .from("tenant_members")
    .select("id, status, referral_code, created_at, profiles(full_name, email)")
    .eq("tenant_id", session.tenant.id)
    .eq("role", "referrer")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apporteurs d'affaires"
        description="Suivez et activez vos apporteurs."
        actions={
          <Button asChild>
            <Link href="/team/invite">
              <PlusCircle className="h-4 w-4" /> Inviter un apporteur
            </Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            {referrers?.length ?? 0} apporteur{(referrers?.length ?? 0) > 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {referrers && referrers.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Inscription</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrers.map((r) => {
                  const profile = pickOne(r.profiles as { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null);
                  return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {profile?.full_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {profile?.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "active" ? "success" : "secondary"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.referral_code ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(r.created_at)}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6">
              <EmptyState
                icon={Handshake}
                title="Aucun apporteur"
                description="Invitez vos premiers apporteurs ou activez la page publique d'inscription."
                action={
                  <Button asChild>
                    <Link href="/team/invite">
                      <PlusCircle className="h-4 w-4" /> Inviter un apporteur
                    </Link>
                  </Button>
                }
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
