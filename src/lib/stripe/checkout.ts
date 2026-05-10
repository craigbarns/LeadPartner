import { getStripe } from "./client";
import { getMainPriceId, type BillingCycle } from "./plans";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { SubscriptionPlan } from "@/types/database";

interface CreateCheckoutInput {
  tenantId: string;
  adminEmail: string;
  plan: SubscriptionPlan;
  cycle: BillingCycle;
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(input: CreateCheckoutInput): Promise<string> {
  const stripe = getStripe();
  const admin = createServiceRoleClient();

  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, stripe_customer_id")
    .eq("tenant_id", input.tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let customerId: string | undefined = sub?.stripe_customer_id ?? undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: input.adminEmail,
      metadata: { tenant_id: input.tenantId },
    });
    customerId = customer.id;
    if (sub?.id) {
      await admin.from("subscriptions").update({ stripe_customer_id: customerId }).eq("id", sub.id);
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: getMainPriceId(input.plan, input.cycle), quantity: 1 }],
    subscription_data: {
      metadata: { tenant_id: input.tenantId },
    },
    automatic_tax: { enabled: true },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: false,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}
