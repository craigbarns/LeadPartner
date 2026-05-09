import { Check, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { PLANS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Plan & facturation · LeadPartner" };

export default async function BillingPage() {
  const session = await requireRole(["company_admin", "super_admin"]);
  if (!session.tenant) return null;

  const supabase = await createClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", session.tenant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <PageHeader title="Plan & facturation" description="Gérez votre abonnement LeadPartner." />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Plan actuel</CardTitle>
            <CardDescription>
              Statut :{" "}
              <Badge variant={subscription?.status === "active" ? "success" : "secondary"}>
                {subscription?.status ?? "trialing"}
              </Badge>
            </CardDescription>
          </div>
          <CreditCard className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Vous êtes actuellement sur le plan{" "}
            <strong className="capitalize">{subscription?.plan ?? "starter"}</strong>.
          </p>
          {subscription?.current_period_end && (
            <p className="text-sm text-muted-foreground">
              Prochaine échéance : {formatDate(subscription.current_period_end)}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <Card
            key={plan.value}
            className={
              subscription?.plan === plan.value ? "border-primary ring-2 ring-primary/20" : ""
            }
          >
            <CardHeader>
              <CardTitle>{plan.label}</CardTitle>
              <CardDescription>
                <span className="text-3xl font-bold text-foreground">{plan.price}€</span> / mois
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-success mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={subscription?.plan === plan.value ? "outline" : "default"}
                disabled
              >
                {subscription?.plan === plan.value ? "Plan actuel" : plan.cta}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Stripe sera activé dans une prochaine étape.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
