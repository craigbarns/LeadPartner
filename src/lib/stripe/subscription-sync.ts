import type Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getPlanFromPriceId } from "./plans";
import type { Database, SubscriptionPlan, SubscriptionStatus } from "@/types/database";

const INCLUDED: Record<SubscriptionPlan, number> = {
  starter: 3,
  pro: 6,
  business: 16,
};

function mapStripeSubscriptionStatus(status: string): SubscriptionStatus {
  const allowed: SubscriptionStatus[] = [
    "trialing",
    "active",
    "past_due",
    "canceled",
    "incomplete",
    "incomplete_expired",
    "unpaid",
  ];
  if (allowed.includes(status as SubscriptionStatus)) return status as SubscriptionStatus;
  return "active";
}

/**
 * Met à jour la ligne `subscriptions` depuis l’objet Stripe (idempotent).
 * `subscription.metadata.tenant_id` doit être défini à la création Checkout.
 */
export async function syncSubscriptionFromStripe(sub: Stripe.Subscription) {
  const tenantId = sub.metadata?.tenant_id;
  if (!tenantId) {
    console.warn(`Stripe subscription ${sub.id} has no tenant_id metadata — skipping sync`);
    return;
  }

  let mainPriceId: string | null = null;
  let extraSeatPriceId: string | null = null;
  let extraSeats = 0;

  for (const item of sub.items.data) {
    const priceId = typeof item.price === "string" ? item.price : item.price.id;
    const lookup = getPlanFromPriceId(priceId);
    if (!lookup) continue;
    if (lookup.kind === "main") {
      mainPriceId = priceId;
    } else if (lookup.kind === "extra") {
      extraSeatPriceId = priceId;
      extraSeats = item.quantity ?? 0;
    }
  }

  if (!mainPriceId) {
    console.warn(`Could not identify main plan for sub ${sub.id}`);
    return;
  }

  const lookup = getPlanFromPriceId(mainPriceId)!;
  const includedSeats = INCLUDED[lookup.plan] ?? 3;

  const admin = createServiceRoleClient();

  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;

  const update: Database["public"]["Tables"]["subscriptions"]["Update"] = {
    plan: lookup.plan,
    status: mapStripeSubscriptionStatus(sub.status),
    billing_cycle: lookup.cycle,
    included_seats: includedSeats,
    extra_seats: extraSeats,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    stripe_price_id: mainPriceId,
    stripe_extra_seat_price_id: extraSeatPriceId,
    current_period_start: sub.current_period_start
      ? new Date(sub.current_period_start * 1000).toISOString()
      : null,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
  };

  if (existing?.id) {
    await admin.from("subscriptions").update(update).eq("id", existing.id);
  } else {
    await admin.from("subscriptions").insert({
      tenant_id: tenantId,
      ...update,
    } as Database["public"]["Tables"]["subscriptions"]["Insert"]);
  }
}
