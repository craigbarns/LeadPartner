import Link from "next/link";
import { PlusCircle, Target } from "lucide-react";
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
import { OpportunityStatusBadge } from "@/components/app/status-badge";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Opportunités · LeadPartner" };

export default async function OpportunitiesPage() {
  const session = await requireTenant();
  const supabase = await createClient();

  let query = supabase
    .from("opportunities")
    .select(
      "id, prospect_name, status, estimated_value, created_at, city, prospect_email, urgency, referrer_id",
    )
    .eq("tenant_id", session.tenant.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (session.role === "referrer") {
    query = query.eq("referrer_id", session.user.id);
  }

  const { data: opportunities } = await query;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Opportunités"
        description="Toutes les opportunités déclarées et leur état d'avancement."
        actions={
          <Button asChild>
            <Link href="/opportunities/new">
              <PlusCircle className="h-4 w-4" /> Nouvelle opportunité
            </Link>
          </Button>
        }
      />
      {opportunities && opportunities.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              {opportunities.length} opportunité{opportunities.length > 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prospect</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Valeur</TableHead>
                  <TableHead>Urgence</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Créé le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunities.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell className="font-medium">
                      <Link href={`/opportunities/${op.id}`} className="hover:underline">
                        {op.prospect_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {op.prospect_email ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{op.city ?? "—"}</TableCell>
                    <TableCell>{formatCurrency(Number(op.estimated_value))}</TableCell>
                    <TableCell className="text-muted-foreground capitalize">
                      {op.urgency ?? "—"}
                    </TableCell>
                    <TableCell>
                      <OpportunityStatusBadge status={op.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(op.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={Target}
          title="Aucune opportunité pour le moment"
          description="Créez votre première opportunité ou invitez vos apporteurs à en déclarer."
          action={
            <Button asChild>
              <Link href="/opportunities/new">
                <PlusCircle className="h-4 w-4" /> Créer une opportunité
              </Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
