import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { INDUSTRIES, OPPORTUNITY_STATUSES } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata = { title: "Analytics · Super admin" };

export default async function AnalyticsPage() {
  const supabase = await createServiceClient();
  const [{ data: tenants }, { data: opportunities }] = await Promise.all([
    supabase.from("tenants").select("industry"),
    supabase.from("opportunities").select("status"),
  ]);

  const byIndustry = INDUSTRIES.map((i) => ({
    ...i,
    count: (tenants ?? []).filter((t) => t.industry === i.value).length,
  }));

  const byStatus = OPPORTUNITY_STATUSES.map((s) => ({
    ...s,
    count: (opportunities ?? []).filter((o) => o.status === s.value).length,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics globales"
        description="Aperçu de l'utilisation de la plateforme."
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entreprises par secteur</CardTitle>
            <CardDescription>Répartition de la base clients</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {byIndustry
                .sort((a, b) => b.count - a.count)
                .map((i) => (
                  <li key={i.value} className="flex items-center justify-between">
                    <span>
                      {i.emoji} {i.label}
                    </span>
                    <Badge variant="secondary">{i.count}</Badge>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opportunités par statut</CardTitle>
            <CardDescription>Pipeline cumulé</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {byStatus
                .filter((s) => s.count > 0)
                .map((s) => (
                  <li key={s.value} className="flex items-center justify-between">
                    <span>{s.label}</span>
                    <Badge variant={s.color}>{s.count}</Badge>
                  </li>
                ))}
              {byStatus.every((s) => s.count === 0) && (
                <li className="text-muted-foreground">Pas encore d&apos;opportunités.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
