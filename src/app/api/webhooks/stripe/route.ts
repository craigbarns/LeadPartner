import { NextResponse } from "next/server";
import type Stripe from "stripe";
import type { Json } from "@/types/database";
import { verifyStripeWebhook } from "@/lib/stripe/webhook-events";
import { syncSubscriptionFromStripe } from "@/lib/stripe/subscription-sync";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const sub = invoice.subscription;
  if (typeof sub === "string") return sub;
  if (sub && typeof sub === "object" && "id" in sub) return sub.id;
  return null;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = verifyStripeWebhook(rawBody, signature);
  } catch (e) {
    return NextResponse.json(
      { error: "invalid_signature", detail: (e as Error).message },
      { status: 401 },
    );
  }

  const admin = createServiceRoleClient();

  const { error: dupErr } = await admin.from("stripe_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: JSON.parse(JSON.stringify(event)) as Json,
  });

  if (dupErr) {
    if ((dupErr as { code?: string }).code === "23505") return NextResponse.json({ ok: true, dedup: true });
    return NextResponse.json({ error: "event_log_failed", detail: dupErr.message }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && typeof session.subscription === "string") {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          await syncSubscriptionFromStripe(sub);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await admin
          .from("subscriptions")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", sub.id);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const sid = subscriptionIdFromInvoice(invoice);
        if (sid) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(sid);
          await syncSubscriptionFromStripe(sub);
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const sid = subscriptionIdFromInvoice(invoice);
        if (sid) {
          await admin.from("subscriptions").update({ status: "past_due" }).eq("stripe_subscription_id", sid);
        }
        break;
      }
      case "customer.subscription.trial_will_end": {
        break;
      }
      default:
        break;
    }

    await admin
      .from("stripe_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "handler_failed", detail: (e as Error).message }, { status: 500 });
  }
}
