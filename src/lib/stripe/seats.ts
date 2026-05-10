import { getStripe } from "./client";
import { getExtraSeatPriceId } from "./plans";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { SubscriptionPlan } from "@/types/database";

async function getLatestSubscriptionRow(tenantId: string) {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select("id, stripe_subscription_id, plan, billing_cycle, extra_seats")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Estime le coût proratisé d’un siège supplémentaire (en centimes).
 */
export async function previewSeatAddition(tenantId: string): Promise<{
  monthlyAmountCents: number;
  proratedAmountCents: number;
}> {
  const sub = await getLatestSubscriptionRow(tenantId);
  if (!sub?.stripe_subscription_id) {
    throw new Error("no_active_subscription");
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
  const plan = sub.plan as SubscriptionPlan;
  const cycle = sub.billing_cycle as "monthly" | "annual";
  const extraPriceId = getExtraSeatPriceId(plan, cycle);
  const extraPrice = await stripe.prices.retrieve(extraPriceId);

  const existingItem = subscription.items.data.find((i) => {
    const pid = typeof i.price === "string" ? i.price : i.price.id;
    return pid === extraPriceId;
  });
  const newQuantity = (existingItem?.quantity ?? 0) + 1;

  const items = existingItem
    ? [{ id: existingItem.id, quantity: newQuantity }]
    : [{ price: extraPriceId, quantity: 1 }];

  const upcoming = await stripe.invoices.retrieveUpcoming({
    subscription: subscription.id,
    subscription_items: items,
    subscription_proration_behavior: "always_invoice",
  });

  const proratedAmountCents = upcoming.lines.data
    .filter((l) => l.proration && l.price && (typeof l.price === "string" ? l.price : l.price.id) === extraPriceId)
    .reduce((sum, l) => sum + (l.amount ?? 0), 0);

  return {
    monthlyAmountCents: extraPrice.unit_amount ?? 0,
    proratedAmountCents,
  };
}

export async function addExtraSeat(tenantId: string): Promise<{ invoiceId: string | null; newExtraSeats: number }> {
  const sub = await getLatestSubscriptionRow(tenantId);
  if (!sub?.stripe_subscription_id || !sub.id) {
    throw new Error("no_active_subscription");
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
  const plan = sub.plan as SubscriptionPlan;
  const cycle = sub.billing_cycle as "monthly" | "annual";
  const extraPriceId = getExtraSeatPriceId(plan, cycle);

  const existingItem = subscription.items.data.find((i) => {
    const pid = typeof i.price === "string" ? i.price : i.price.id;
    return pid === extraPriceId;
  });
  const newQuantity = (existingItem?.quantity ?? 0) + 1;

  const updated = await stripe.subscriptions.update(subscription.id, {
    items: existingItem
      ? [{ id: existingItem.id, quantity: newQuantity }]
      : [{ price: extraPriceId, quantity: 1 }],
    proration_behavior: "always_invoice",
  });

  const admin = createServiceRoleClient();
  await admin.from("subscriptions").update({ extra_seats: newQuantity }).eq("id", sub.id);

  const inv = updated.latest_invoice;
  const invoiceId = typeof inv === "string" ? inv : inv?.id ?? null;

  return {
    invoiceId,
    newExtraSeats: newQuantity,
  };
}

export async function removeExtraSeat(tenantId: string): Promise<{ newExtraSeats: number }> {
  const sub = await getLatestSubscriptionRow(tenantId);
  if (!sub?.stripe_subscription_id || !sub.id) {
    throw new Error("no_active_subscription");
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
  const plan = sub.plan as SubscriptionPlan;
  const cycle = sub.billing_cycle as "monthly" | "annual";
  const extraPriceId = getExtraSeatPriceId(plan, cycle);
  const existingItem = subscription.items.data.find((i) => {
    const pid = typeof i.price === "string" ? i.price : i.price.id;
    return pid === extraPriceId;
  });
  if (!existingItem || (existingItem.quantity ?? 0) <= 0) return { newExtraSeats: 0 };

  const newQuantity = (existingItem.quantity ?? 0) - 1;

  if (newQuantity === 0) {
    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: existingItem.id, deleted: true }],
      proration_behavior: "none",
    });
  } else {
    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: existingItem.id, quantity: newQuantity }],
      proration_behavior: "none",
    });
  }

  const admin = createServiceRoleClient();
  await admin.from("subscriptions").update({ extra_seats: newQuantity }).eq("id", sub.id);

  return { newExtraSeats: newQuantity };
}
