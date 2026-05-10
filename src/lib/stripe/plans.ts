import type { SubscriptionPlan } from "@/types/database";

export type BillingCycle = "monthly" | "annual";

const MAIN_ENV: Record<SubscriptionPlan, Record<BillingCycle, string>> = {
  starter: {
    monthly: "STRIPE_PRICE_STARTER_MONTHLY",
    annual: "STRIPE_PRICE_STARTER_ANNUAL",
  },
  pro: {
    monthly: "STRIPE_PRICE_PRO_MONTHLY",
    annual: "STRIPE_PRICE_PRO_ANNUAL",
  },
  business: {
    monthly: "STRIPE_PRICE_BUSINESS_MONTHLY",
    annual: "STRIPE_PRICE_BUSINESS_ANNUAL",
  },
};

const EXTRA_ENV: Record<SubscriptionPlan, Record<BillingCycle, string>> = {
  starter: {
    monthly: "STRIPE_PRICE_EXTRA_SEAT_STARTER_MONTHLY",
    annual: "STRIPE_PRICE_EXTRA_SEAT_STARTER_ANNUAL",
  },
  pro: {
    monthly: "STRIPE_PRICE_EXTRA_SEAT_PRO_MONTHLY",
    annual: "STRIPE_PRICE_EXTRA_SEAT_PRO_ANNUAL",
  },
  business: {
    monthly: "STRIPE_PRICE_EXTRA_SEAT_BUSINESS_MONTHLY",
    annual: "STRIPE_PRICE_EXTRA_SEAT_BUSINESS_ANNUAL",
  },
};

function readEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} env var is required`);
  return v;
}

export function getMainPriceId(plan: SubscriptionPlan, cycle: BillingCycle): string {
  return readEnv(MAIN_ENV[plan][cycle]);
}

export function getExtraSeatPriceId(plan: SubscriptionPlan, cycle: BillingCycle): string {
  return readEnv(EXTRA_ENV[plan][cycle]);
}

export interface PriceLookup {
  plan: SubscriptionPlan;
  cycle: BillingCycle;
  kind: "main" | "extra";
}

export function getPlanFromPriceId(priceId: string): PriceLookup | null {
  for (const plan of ["starter", "pro", "business"] as SubscriptionPlan[]) {
    for (const cycle of ["monthly", "annual"] as BillingCycle[]) {
      try {
        if (getMainPriceId(plan, cycle) === priceId) return { plan, cycle, kind: "main" };
        if (getExtraSeatPriceId(plan, cycle) === priceId) return { plan, cycle, kind: "extra" };
      } catch {
        // env absent — skip
      }
    }
  }
  return null;
}
