import { describe, it, expect } from "vitest";
import { evaluateSubscriptionAccess } from "./require-active-subscription";

describe("evaluateSubscriptionAccess", () => {
  it("allows when status is active", () => {
    expect(
      evaluateSubscriptionAccess({
        status: "active",
        trial_ends_at: null,
      }),
    ).toEqual({ allowed: true });
  });

  it("allows when trialing and not expired", () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    expect(
      evaluateSubscriptionAccess({
        status: "trialing",
        trial_ends_at: tomorrow,
      }),
    ).toEqual({ allowed: true });
  });

  it("blocks when trialing but trial expired", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    expect(
      evaluateSubscriptionAccess({
        status: "trialing",
        trial_ends_at: yesterday,
      }),
    ).toEqual({ allowed: false, reason: "trial_expired" });
  });

  it("blocks when canceled", () => {
    expect(
      evaluateSubscriptionAccess({
        status: "canceled",
        trial_ends_at: null,
      }),
    ).toEqual({ allowed: false, reason: "subscription_inactive" });
  });

  it("blocks when unpaid", () => {
    expect(
      evaluateSubscriptionAccess({
        status: "unpaid",
        trial_ends_at: null,
      }),
    ).toEqual({ allowed: false, reason: "subscription_inactive" });
  });

  it("blocks when incomplete_expired", () => {
    expect(
      evaluateSubscriptionAccess({
        status: "incomplete_expired",
        trial_ends_at: null,
      }),
    ).toEqual({ allowed: false, reason: "subscription_inactive" });
  });

  it("allows when past_due (Stripe handles retries, app stays open)", () => {
    expect(
      evaluateSubscriptionAccess({
        status: "past_due",
        trial_ends_at: null,
      }),
    ).toEqual({ allowed: true });
  });

  it("blocks when no subscription", () => {
    expect(evaluateSubscriptionAccess(null)).toEqual({
      allowed: false,
      reason: "no_subscription",
    });
  });
});
