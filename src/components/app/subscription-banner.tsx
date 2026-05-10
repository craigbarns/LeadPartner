import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function SubscriptionBanner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("role", "company_admin")
    .limit(1)
    .maybeSingle();
  if (!member) return null;

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at, current_period_end, cancel_at_period_end")
    .eq("tenant_id", member.tenant_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) return null;

  const now = Date.now();
  const trialEnds = sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : 0;
  const daysLeft = Math.ceil((trialEnds - now) / 86400000);

  let message: string | null = null;
  let color: "yellow" | "orange" | "red" | "gray" = "yellow";

  if (sub.status === "trialing" && trialEnds < now) {
    message = "Compte en lecture seule. Activez votre abonnement.";
    color = "red";
  } else if (sub.status === "trialing" && daysLeft <= 2 && trialEnds >= now) {
    message = `Essai expire dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}. Activez maintenant.`;
    color = "orange";
  } else if (sub.status === "trialing" && daysLeft <= 7 && trialEnds >= now) {
    message = `Essai : ${daysLeft} jours restants. Configurez votre plan.`;
    color = "yellow";
  } else if (sub.status === "past_due") {
    message = "Paiement échoué. Mettez à jour votre carte.";
    color = "red";
  } else if (
    sub.status === "canceled" ||
    sub.status === "unpaid" ||
    sub.status === "incomplete_expired"
  ) {
    message = "Compte en lecture seule. Activez votre abonnement.";
    color = "red";
  } else if (sub.cancel_at_period_end && sub.current_period_end) {
    const end = new Date(sub.current_period_end).toLocaleDateString("fr-FR");
    message = `Abonnement résilié, accès jusqu'au ${end}.`;
    color = "gray";
  }

  if (!message) return null;

  const colorClasses = {
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-900",
    orange: "bg-orange-50 border-orange-200 text-orange-900",
    red: "bg-red-50 border-red-200 text-red-900",
    gray: "bg-gray-50 border-gray-200 text-gray-700",
  }[color];

  return (
    <div className={`border-b ${colorClasses} px-4 py-2 text-sm flex items-center justify-between shrink-0`}>
      <span>{message}</span>
      <Link href="/settings/billing" className="underline font-medium ml-4 whitespace-nowrap">
        Gérer mon abonnement
      </Link>
    </div>
  );
}
