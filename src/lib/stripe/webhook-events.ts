import Stripe from "stripe";

export function verifyStripeWebhook(rawBody: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET env var is required");
  return Stripe.webhooks.constructEvent(rawBody, signature, secret);
}
