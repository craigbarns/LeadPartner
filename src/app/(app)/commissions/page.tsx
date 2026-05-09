import Link from "next/link";
import { CreditCard, Settings } from "lucide-react";
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
import { CommissionStatusBadge } from "@/components/app/status-badge";
import { CommissionRowActions } from "./row-actions";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Commissions · LeadPartner" };

export default async function CommissionsPage() {
  const session = await requireTenant();
  const supabase = await createClient();
  const isReferrer = session.role === "referrer";
  const canValidate = session.role === "company_admin";

  let query = supabase
    .from("commissions")
    .select(
      "id, status, amount, base_amount, due_at, paid_at, created_at, opportunity_id, referrer_id, opportunities(prospect_name)",
    )
    .eq("tenant_id", session.tenant.id)
    .order("created_at", { ascending: false });

  if (isReferrer) query = query.eq("referrer_id", session.user.id);

  type CommissionRow = {
    id: string;
    status: import("@/types/database").CommissionStatus;
    amount: number;
    base_amount: number | null;
    due_at: string | null;
    paid_at: string | null;
    created_at: string;
    opportunity_id: string;
    referrer_id: string;
    opportunities: { prospect_name: string } | { prospect_name: string }[] | null;
  };
  const { data } = await query;
  const commissions = (data ?? []) as CommissionRow[];

  function opportunityName(op: CommissionRow["opportunities"]) {
    if (!op) return "—";
    if (Array.isArray(op)) return op[0]?.prospect_name ?? "—";
    return op.prospect_name ?? "—";
  }

  const totalDue = (commissions ?? [])
    .filter((c) => c.status === "due" || c.status === "validated")
    .reduce((acc, c) => acc + Number(c.amount), 0);
  const totalPaid = (commissions ?? [])
    .filter((c) => c.status === "paid")
    .reduce((acc, c) => acc + Number(c.amount), 0);
  const totalEstimated = (commissions ?? [])
    .filter((c) => c.status === "estimated")
    .reduce((acc, c) => acc + Number(c.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={isReferrer ? "Mes commissions" : "Commissions"}
        description={
          isReferrer
            ? "Suivez vos commissions estimées, dues et payées."
            : "Validez et payez les commissions de vos apporteurs."
        }
        actions={
          !isReferrer && (
            <Button asChild variant="outline">
              <Link href="/settings/commissions">
                <Settings className="h-4 w-4" /> Règles de commission
              </Link>
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Estimées"
          value={formatCurrency(totalEstimated)}
          accentColor={session.tenant.primary_color ?? undefined}
          hint="Sur opportunités en cours"
        />
        <StatCard
          title="À payer"
          value={formatCurrency(totalDue)}
          icon={CreditCard}
          accentColor={session.tenant.primary_color ?? undefined}
        />
        <StatCard
          title="Payées"
          value={formatCurrency(totalPaid)}
          accentColor={session.tenant.primary_color ?? undefined}
        />
      </div>

      {commissions && commissions.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              {commissions.length} commission{commissions.length > 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opportunité</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Créée le</TableHead>
                  {canValidate && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link href={`/opportunities/${c.opportunity_id}`} className="hover:underline">
                        {opportunityName(c.opportunities)}
                      </Link>
                    </TableCell>
                    <TableCell>{formatCurrency(Number(c.amount))}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.base_amount ? formatCurrency(Number(c.base_amount)) : "—"}
                    </TableCell>
                    <TableCell>
                      <CommissionStatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {c.due_at ? formatDate(c.due_at) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(c.created_at)}
                    </TableCell>
                    {canValidate && (
                      <TableCell className="text-right">
                        <CommissionRowActions id={c.id} status={c.status} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={CreditCard}
          title="Aucune commission pour l'instant"
          description="Les commissions sont créées automatiquement quand vous validez une opportunité gagnée. Vous pouvez aussi les ajouter manuellement plus tard."
        />
      )}
    </div>
  );
}
