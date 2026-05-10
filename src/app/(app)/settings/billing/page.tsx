import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { PLANS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { PlanSelector } from "./plan-selector";
import { SeatsList } from "./seats-list";
import { openPortal } from "./billing-actions";
import { isStripeEnabled } from "@/lib/env";

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

  const { data: members } = await supabase
    .from("tenant_members")
    .select("id, role, profile:profiles!tenant_members_user_id_fkey(full_name, email)")
    .eq("tenant_id", session.tenant.id)
    .in("role", ["company_admin", "collaborator"])
    .eq("status", "active")
    .order("created_at", { ascending: true });

  type MemberRow = {
    id: string;
    role: string;
    profile: { full_name: string | null; email: string } | null;
  };

  const seats = (members as MemberRow[] | null)?.map((m) => ({
    id: m.id,
    full_name: m.profile?.full_name ?? null,
    email: m.profile?.email ?? "",
    role: m.role === "company_admin" ? "Admin" : "Collaborateur",
  })) ?? [];

  const isActive =
    subscription?.status === "active" ||
    subscription?.status === "past_due" ||
    (subscription?.status === "trialing" &&
      subscription.trial_ends_at &&
      new Date(subscription.trial_ends_at) >= new Date());

  const planConfig = subscription ? PLANS.find((p) => p.value === subscription.plan) : null;
  const stripeOn = isStripeEnabled();

  return (
    <div className="space-y-6">
      <PageHeader title="Plan & facturation" description="Gérez votre abonnement LeadPartner." />

      {!stripeOn && (
        <p className="text-sm text-muted-foreground border border-dashed rounded-md p-3">
          La facturation Stripe n&apos;est pas configurée sur cet environnement (clé secrète manquante).
        </p>
      )}

      {isActive && subscription && planConfig ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>
                {planConfig.label} · {subscription.billing_cycle === "annual" ? "Annuel" : "Mensuel"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Prochaine facture :{" "}
                {subscription.current_period_end ? formatDate(subscription.current_period_end) : "—"}
              </p>
            </div>
            <Badge variant={subscription.status === "past_due" ? "destructive" : "success"}>
              {subscription.status === "past_due"
                ? "Paiement en attente"
                : subscription.status === "trialing"
                  ? "Essai"
                  : "Actif"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              {subscription.included_seats} sièges inclus + {subscription.extra_seats} extras
            </p>
            {stripeOn && subscription.stripe_customer_id ? (
              <form action={openPortal}>
                <Button type="submit" variant="outline">
                  Gérer mon abonnement (Stripe)
                </Button>
              </form>
            ) : (
              <p className="text-xs text-muted-foreground">
                Portail client disponible après configuration Stripe et premier paiement.
              </p>
            )}
          </CardContent>
        </Card>
      ) : stripeOn ? (
        <PlanSelector />
      ) : (
        <p className="text-sm text-muted-foreground">
          Activez Stripe pour souscrire en ligne. En attendant, contactez le support pour un accès payant.
        </p>
      )}

      {isActive && planConfig && subscription && (
        <SeatsList
          seats={seats}
          includedSeats={subscription.included_seats}
          extraSeatPrice={planConfig.extra_seat_monthly}
        />
      )}
    </div>
  );
}
