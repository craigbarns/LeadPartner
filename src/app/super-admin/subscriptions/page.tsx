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
import { createServiceClient } from "@/lib/supabase/server";
import { pickOne } from "@/lib/supabase-helpers";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Abonnements · Super admin" };

export default async function SubscriptionsPage() {
  const supabase = await createServiceClient();
  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("id, plan, status, current_period_end, created_at, tenants(name, slug)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abonnements"
        description="Vue centralisée des abonnements clients."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {subscriptions?.length ?? 0} abonnements
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entreprise</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Renouvellement</TableHead>
                <TableHead>Créé le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(subscriptions ?? []).map((s) => {
                const tenant = pickOne(s.tenants as { name: string; slug: string } | { name: string; slug: string }[] | null);
                return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {tenant?.name}{" "}
                    <span className="text-muted-foreground text-xs">
                      ({tenant?.slug})
                    </span>
                  </TableCell>
                  <TableCell className="capitalize">{s.plan}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        s.status === "active"
                          ? "success"
                          : s.status === "trialing"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {s.current_period_end ? formatDate(s.current_period_end) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(s.created_at)}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
