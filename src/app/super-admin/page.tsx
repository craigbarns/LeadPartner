import {
  Building2,
  CreditCard,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { INDUSTRIES, PLANS } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Super admin · LeadPartner" };

export default async function SuperAdminPage() {
  const supabase = await createServiceClient();
  const [
    { count: tenantsCount },
    { count: opportunitiesCount },
    { count: usersCount },
    { data: subscriptions },
    { data: tenants },
  ] = await Promise.all([
    supabase.from("tenants").select("*", { count: "exact", head: true }),
    supabase.from("opportunities").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("subscriptions").select("plan, status"),
    supabase
      .from("tenants")
      .select("id, name, slug, industry, subscription_plan, subscription_status, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const activeSubs = (subscriptions ?? []).filter(
    (s) => s.status === "active" || s.status === "trialing",
  );
  const mrr = activeSubs.reduce((acc, s) => {
    const plan = PLANS.find((p) => p.value === s.plan);
    return acc + (plan?.price ?? 0);
  }, 0);

  const trialing = activeSubs.filter((s) => s.status === "trialing").length;

  const byIndustry = INDUSTRIES.map((i) => ({
    label: i.label,
    emoji: i.emoji,
    count: (tenants ?? []).filter((t) => t.industry === i.value).length,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vue super administrateur"
        description="Pilotage global de la plateforme LeadPartner."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Entreprises clientes"
          value={tenantsCount ?? 0}
          icon={Building2}
          accentColor="#0F172A"
        />
        <StatCard
          title="MRR estimé"
          value={formatCurrency(mrr)}
          icon={CreditCard}
          accentColor="#0F172A"
          hint={`${activeSubs.length} abonnements actifs`}
        />
        <StatCard
          title="Utilisateurs"
          value={usersCount ?? 0}
          icon={Users}
          accentColor="#0F172A"
        />
        <StatCard
          title="Opportunités totales"
          value={opportunitiesCount ?? 0}
          icon={Target}
          accentColor="#0F172A"
          hint={`${trialing} entreprises en essai`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Dernières entreprises inscrites</CardTitle>
          </CardHeader>
          <CardContent>
            {tenants && tenants.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Secteur</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Inscrite le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="font-mono text-xs">{t.slug}</TableCell>
                      <TableCell>
                        {INDUSTRIES.find((i) => i.value === t.industry)?.label ?? t.industry}
                      </TableCell>
                      <TableCell className="capitalize">{t.subscription_plan}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            t.subscription_status === "active"
                              ? "success"
                              : t.subscription_status === "trialing"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {t.subscription_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(t.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucune entreprise inscrite pour le moment.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Répartition par secteur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {byIndustry
                .filter((i) => i.count > 0)
                .map((i) => (
                  <li key={i.label} className="flex items-center justify-between">
                    <span>
                      {i.emoji} {i.label}
                    </span>
                    <Badge variant="secondary">{i.count}</Badge>
                  </li>
                ))}
              {byIndustry.every((i) => i.count === 0) && (
                <li className="text-muted-foreground">
                  Pas encore de données sectorielles.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Plans actifs
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PLANS.map((plan) => {
            const count = activeSubs.filter((s) => s.plan === plan.value).length;
            return (
              <div key={plan.value} className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">{plan.label}</p>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(count * plan.price)} / mois
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
