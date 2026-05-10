import { describe, it, expect, beforeAll } from "vitest";
import { getMainPriceId, getExtraSeatPriceId, getPlanFromPriceId } from "./plans";

beforeAll(() => {
  process.env.STRIPE_PRICE_STARTER_MONTHLY = "price_starter_m";
  process.env.STRIPE_PRICE_STARTER_ANNUAL = "price_starter_a";
  process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_m";
  process.env.STRIPE_PRICE_PRO_ANNUAL = "price_pro_a";
  process.env.STRIPE_PRICE_BUSINESS_MONTHLY = "price_biz_m";
  process.env.STRIPE_PRICE_BUSINESS_ANNUAL = "price_biz_a";
  process.env.STRIPE_PRICE_EXTRA_SEAT_STARTER_MONTHLY = "price_extra_s_m";
  process.env.STRIPE_PRICE_EXTRA_SEAT_STARTER_ANNUAL = "price_extra_s_a";
  process.env.STRIPE_PRICE_EXTRA_SEAT_PRO_MONTHLY = "price_extra_p_m";
  process.env.STRIPE_PRICE_EXTRA_SEAT_PRO_ANNUAL = "price_extra_p_a";
  process.env.STRIPE_PRICE_EXTRA_SEAT_BUSINESS_MONTHLY = "price_extra_b_m";
  process.env.STRIPE_PRICE_EXTRA_SEAT_BUSINESS_ANNUAL = "price_extra_b_a";
});

describe("plans", () => {
  it("returns the correct main price for plan + cycle", () => {
    expect(getMainPriceId("starter", "monthly")).toBe("price_starter_m");
    expect(getMainPriceId("starter", "annual")).toBe("price_starter_a");
    expect(getMainPriceId("pro", "monthly")).toBe("price_pro_m");
    expect(getMainPriceId("business", "annual")).toBe("price_biz_a");
  });

  it("returns the correct extra seat price for plan + cycle", () => {
    expect(getExtraSeatPriceId("starter", "monthly")).toBe("price_extra_s_m");
    expect(getExtraSeatPriceId("pro", "annual")).toBe("price_extra_p_a");
    expect(getExtraSeatPriceId("business", "monthly")).toBe("price_extra_b_m");
  });

  it("reverses a price ID back to plan + cycle", () => {
    expect(getPlanFromPriceId("price_pro_m")).toEqual({
      plan: "pro",
      cycle: "monthly",
      kind: "main",
    });
    expect(getPlanFromPriceId("price_extra_b_a")).toEqual({
      plan: "business",
      cycle: "annual",
      kind: "extra",
    });
    expect(getPlanFromPriceId("unknown_price")).toBeNull();
  });

  it("throws when an env var is missing", () => {
    delete process.env.STRIPE_PRICE_PRO_MONTHLY;
    expect(() => getMainPriceId("pro", "monthly")).toThrow(/STRIPE_PRICE_PRO_MONTHLY/);
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_m";
  });
});
