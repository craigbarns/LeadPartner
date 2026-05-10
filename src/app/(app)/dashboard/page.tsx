import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  CreditCard,
  Handshake,
  PlusCircle,
  Target,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { OpportunityStatusBadge } from "@/components/app/status-badge";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await requireTenant();
  if (session.role === "referrer") redirect("/dashboard/referrer");

  const supabase = await createClient();
  const tenantId = session.tenant.id;

  const [
    { count: opportunitiesCount },
    { count: referrersCount },
    { count: activeOps },
    { data: recentOps },
    { data: commissions },
  ] = await Promise.all([
    supabase
      .from("opportunities")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("tenant_members")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("role", "referrer")
      .eq("status", "active"),
    supabase
      .from("opportunities")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("status", "in", "(rejected,lost,commission_paid)"),
    supabase
      .from("opportunities")
      .select("id, prospect_name, status, estimated_value, created_at, city")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("commissions").select("status, amount").eq("tenant_id", tenantId),
  ]);

  const commissionsDue = (commissions ?? [])
    .filter((c) => c.status === "due" || c.status === "validated")
    .reduce((acc, c) => acc + Number(c.amount), 0);

  const commissionsPaid = (commissions ?? [])
    .filter((c) => c.status === "paid")
    .reduce((acc, c) => acc + Number(c.amount), 0);

  const conversionRate = (() => {
    const total = opportunitiesCount ?? 0;
    if (!total) return 0;
    const won = (recentOps ?? []).filter((o) =>
      ["sale_closed", "commission_due", "commission_paid"].includes(o.status),
    ).length;
    return Math.round((won / Math.max(total, 1)) * 100);
  })();

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={`Bonjour ${session.profile.full_name?.split(" ")[0] ?? ""} · ${new Date().toLocaleDateString("fr-FR", { weekday: "long" })}`}
        title="Tableau de bord"
        description={`Aperçu de l'activité chez ${session.tenant.name}.`}
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            {(session.role === "company_admin" || session.role === "collaborator") && (
              <Button asChild variant="outline" className="rounded-none h-11">
                <Link href="/team/invite" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" /> Inviter
                </Link>
              </Button>
            )}
            <Button asChild className="rounded-none h-11">
              <Link href="/opportunities/new" className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4" /> Déclarer une opportunité
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
        <div className="bg-background">
          <StatCard
            title="Apporteurs actifs"
            value={referrersCount ?? 0}
            icon={Handshake}
            hint="Membres avec rôle apporteur"
          />
        </div>
        <div className="bg-background">
          <StatCard
            title="Opportunités totales"
            value={opportunitiesCount ?? 0}
            icon={Target}
            hint={`${activeOps ?? 0} en cours · ${conversionRate}% conv.`}
          />
        </div>
        <div className="bg-background">
          <StatCard
            title="Conversion 30j"
            value={`${conversionRate}%`}
            icon={TrendingUp}
            hint="Sur opportunités récentes"
          />
        </div>
        <div className="bg-background">
          <StatCard
            title="Commissions à payer"
            value={formatCurrency(commissionsDue)}
            icon={CreditCard}
            accent
            hint={`${formatCurrency(commissionsPaid)} déjà réglés`}
          />
        </div>
      </div>

      {/* Two column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 border border-border bg-card">
          <header className="flex items-center justify-between p-5 lg:p-6 border-b border-border">
            <div>
              <div className="micro text-muted-foreground">Pipeline · récent</div>
              <h2 className="font-display text-2xl mt-1">Opportunités</h2>
            </div>
            <Button asChild size="sm" variant="ghost" className="rounded-none">
              <Link href="/opportunities" className="flex items-center gap-1">
                Voir tout <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </header>
          {recentOps && recentOps.length ? (
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
                {recentOps.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell className="font-medium">
                      <Link href={`/opportunities/${op.id}`} className="hover:bg-accent hover:text-accent-foreground px-1">
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
            <div className="p-10 text-sm text-muted-foreground">
              Aucune opportunité pour le moment.{" "}
              {session.role === "collaborator"
                ? "Invitez des apporteurs via le bouton « Inviter » ou la page Équipe."
                : "Invitez vos premiers apporteurs depuis la page Équipe."}
            </div>
          )}
        </section>

        <aside className="border border-border bg-card flex flex-col">
          <header className="p-5 lg:p-6 border-b border-border">
            <div className="micro text-muted-foreground">Setup</div>
            <h2 className="font-display text-2xl mt-1">Démarrage rapide</h2>
          </header>
          <div className="divide-y divide-border">
            {(session.role === "collaborator"
              ? [
                  {
                    href: "/team/invite",
                    num: "01",
                    title: "Inviter un apporteur",
                    hint: "Générez un lien d’invitation à partager par email",
                  },
                  {
                    href: "/referrers",
                    num: "02",
                    title: "Apporteurs",
                    hint: "Voir la liste et les codes",
                  },
                  {
                    href: "/team",
                    num: "03",
                    title: "Équipe",
                    hint: "Membres et invitations en attente",
                  },
                ]
              : [
                  {
                    href: "/program",
                    num: "01",
                    title: "Configurer le programme",
                    hint: "Conditions, page publique, lien d'invitation",
                  },
                  {
                    href: "/team/invite",
                    num: "02",
                    title: "Inviter votre équipe",
                    hint: "Collaborateurs et apporteurs",
                  },
                  {
                    href: "/settings/commissions",
                    num: "03",
                    title: "Règles de commission",
                    hint: "Fixe, pourcentage ou par paliers",
                  },
                ]
            ).map((step) => (
              <Link
                key={step.href}
                href={step.href}
                className="flex items-start gap-4 p-5 hover:bg-foreground hover:text-background transition-colors group"
              >
                <span className="font-mono text-xs tabular text-muted-foreground group-hover:text-background/60 mt-1">
                  {step.num}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-sm">{step.title}</p>
                  <p className="text-xs text-muted-foreground group-hover:text-background/60 mt-0.5">
                    {step.hint}
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 mt-1 opacity-0 group-hover:opacity-100 transition" />
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
