import { describe, it, expect } from "vitest";
import { formatPhoneForYousign } from "./phone";

describe("formatPhoneForYousign", () => {
  it("returns undefined for empty or whitespace", () => {
    expect(formatPhoneForYousign(undefined)).toBeUndefined();
    expect(formatPhoneForYousign("")).toBeUndefined();
    expect(formatPhoneForYousign("   ")).toBeUndefined();
  });

  it("normalizes French 0-prefix to +33", () => {
    expect(formatPhoneForYousign("06 12 34 56 78")).toBe("+33612345678");
    expect(formatPhoneForYousign("0612345678")).toBe("+33612345678");
  });

  it("keeps existing +33", () => {
    expect(formatPhoneForYousign("+33 6 12 34 56 78")).toBe("+33612345678");
  });

  it("returns undefined for invalid garbage", () => {
    expect(formatPhoneForYousign("abc")).toBeUndefined();
  });
});
