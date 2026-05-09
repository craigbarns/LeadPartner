import Link from "next/link";
import {
  ArrowUpRight,
  Copy,
  CreditCard,
  PlusCircle,
  Target,
  Trophy,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { StatCard } from "@/components/app/stat-card";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function ReferrerDashboardPage() {
  const session = await requireTenant();
  const supabase = await createClient();
  const tenantId = session.tenant.id;
  const userId = session.user.id;

  const [{ data: opportunities }, { data: commissions }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, prospect_name, status, estimated_value, created_at, city")
      .eq("tenant_id", tenantId)
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("commissions")
      .select("status, amount")
      .eq("tenant_id", tenantId)
      .eq("referrer_id", userId),
  ]);

  const totalOpportunities = opportunities?.length ?? 0;
  const wonOpportunities = (opportunities ?? []).filter((o) =>
    ["sale_closed", "commission_due", "commission_paid"].includes(o.status),
  ).length;

  const estimatedCommissions = (commissions ?? [])
    .filter((c) => c.status === "estimated")
    .reduce((acc, c) => acc + Number(c.amount), 0);
  const dueCommissions = (commissions ?? [])
    .filter((c) => c.status === "due" || c.status === "validated")
    .reduce((acc, c) => acc + Number(c.amount), 0);
  const paidCommissions = (commissions ?? [])
    .filter((c) => c.status === "paid")
    .reduce((acc, c) => acc + Number(c.amount), 0);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={`Bonjour ${session.profile.full_name?.split(" ")[0] ?? ""}`}
        title="Mon espace apporteur"
        description={`${session.tenant.name} · suivi de votre activité.`}
        actions={
          <Button asChild className="rounded-none h-11">
            <Link href="/opportunities/new" className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" /> Déclarer
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
        <div className="bg-background">
          <StatCard title="Opportunités" value={totalOpportunities} icon={Target} hint="Total déclarées" />
        </div>
        <div className="bg-background">
          <StatCard
            title="Gagnées"
            value={wonOpportunities}
            icon={Trophy}
            hint={`${Math.round((wonOpportunities / Math.max(totalOpportunities, 1)) * 100)}% de conversion`}
          />
        </div>
        <div className="bg-background">
          <StatCard
            title="Commissions dues"
            value={formatCurrency(dueCommissions)}
            icon={CreditCard}
            accent
            hint={`Estimées : ${formatCurrency(estimatedCommissions)}`}
          />
        </div>
        <div className="bg-background">
          <StatCard
            title="Total payé"
            value={formatCurrency(paidCommissions)}
            icon={Wallet}
            hint="Cumul depuis l'inscription"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 border border-border bg-card">
          <header className="flex items-center justify-between p-5 lg:p-6 border-b border-border">
            <div>
              <div className="micro text-muted-foreground">Mes dossiers</div>
              <h2 className="font-display text-2xl mt-1">Dernières opportunités</h2>
            </div>
            <Button asChild size="sm" variant="ghost" className="rounded-none">
              <Link href="/opportunities" className="flex items-center gap-1">
                Voir tout <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </header>
          {opportunities && opportunities.length ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                  <TableHead className="micro">Prospect</TableHead>
                  <TableHead className="micro">Ville</TableHead>
                  <TableHead className="micro">Valeur</TableHead>
                  <TableHead className="micro">Statut</TableHead>
                  <TableHead className="micro">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunities.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/opportunities/${op.id}`}
                        className="hover:bg-accent hover:text-accent-foreground px-1"
                      >
                        {op.prospect_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{op.city ?? "—"}</TableCell>
                    <TableCell className="font-mono tabular text-sm">
                      {formatCurrency(Number(op.estimated_value))}
                    </TableCell>
                    <TableCell>
                      <OpportunityStatusBadge status={op.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono tabular">
                      {formatDate(op.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-sm text-muted-foreground p-10 text-center">
              Aucune opportunité pour le moment. Cliquez sur « Déclarer » pour démarrer.
            </div>
          )}
        </section>

        <aside className="border border-border bg-card flex flex-col">
          <header className="p-5 lg:p-6 border-b border-border">
            <div className="micro text-muted-foreground">Mon code</div>
            <h2 className="font-display text-2xl mt-1">Parrainage</h2>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Partagez ce code pour recommander {session.tenant.name}. Toute
              opportunité issue de votre lien est automatiquement attribuée.
            </p>
          </header>
          <div className="p-5 lg:p-6 flex-1 flex flex-col gap-4">
            <div className="border border-border p-4 bg-secondary/40">
              <div className="micro text-muted-foreground mb-2">Code unique</div>
              <code className="font-mono text-2xl tabular tracking-tightest break-all">
                {session.membership?.referral_code ?? "—"}
              </code>
            </div>
            <Button asChild variant="outline" className="rounded-none h-11 w-full">
              <Link href="/referral" className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Copy className="h-4 w-4" /> Voir mon lien
                </span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
