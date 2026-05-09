import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { INDUSTRIES } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Entreprises · Super admin" };

export default async function TenantsPage() {
  const supabase = await createServiceClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select(
      "id, name, slug, industry, subscription_plan, subscription_status, custom_domain, created_at",
    )
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Toutes les entreprises"
        description={`${tenants?.length ?? 0} clients sur la plateforme`}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Liste complète</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Secteur</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Domaine perso</TableHead>
                <TableHead>Inscription</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tenants ?? []).map((t) => (
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
                  <TableCell className="text-sm">{t.custom_domain ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(t.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
