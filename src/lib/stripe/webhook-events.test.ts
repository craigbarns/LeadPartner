import { describe, it, expect, beforeAll } from "vitest";
import { verifyStripeWebhook } from "./webhook-events";
import Stripe from "stripe";

const SECRET = "whsec_test_secret";

beforeAll(() => {
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
});

function signedHeader(payload: string, ts: number): string {
  const stripe = new Stripe("sk_test_dummy");
  return stripe.webhooks.generateTestHeaderString({
    payload,
    secret: SECRET,
    timestamp: ts,
  });
}

describe("verifyStripeWebhook", () => {
  it("accepts a valid signature", () => {
    const payload = JSON.stringify({ id: "evt_test", type: "invoice.paid" });
    const sig = signedHeader(payload, Math.floor(Date.now() / 1000));
    const event = verifyStripeWebhook(payload, sig);
    expect(event.id).toBe("evt_test");
    expect(event.type).toBe("invoice.paid");
  });

  it("rejects a tampered payload", () => {
    const payload = JSON.stringify({ id: "evt_test", type: "invoice.paid" });
    const sig = signedHeader(payload, Math.floor(Date.now() / 1000));
    expect(() => verifyStripeWebhook('{"id":"different"}', sig)).toThrow();
  });

  it("rejects when secret is missing", () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect(() => verifyStripeWebhook("{}", "sig")).toThrow(/STRIPE_WEBHOOK_SECRET/);
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  });
});
