import { describe, expect, it } from "vitest";
import { discountFor, generateCoupons, type CouponRow } from "./coupons.ts";
import { assertAllowed } from "./guardrails.ts";
import { createRandom, REFERENCE_DATE } from "./random.ts";

const coupons = generateCoupons(createRandom());
const REFERENCE_MS = Date.parse(REFERENCE_DATE);

const coupon = (overrides: Partial<CouponRow>): CouponRow => ({
  ...coupons[0]!,
  percentOff: null,
  amountOffPaise: null,
  ...overrides,
});

describe("generateCoupons", () => {
  it("makes 8 active, 4 expired and 3 limited codes", () => {
    const expired = coupons.filter((c) => c.validUntil.epochMilliseconds < REFERENCE_MS);
    const limited = coupons.filter((c) => c.maxUses !== null);

    expect(coupons).toHaveLength(15);
    expect(expired).toHaveLength(4);
    expect(limited).toHaveLength(3);
    expect(limited.every((c) => c.validUntil.epochMilliseconds > REFERENCE_MS)).toBe(true);
    expect(coupons.length - expired.length - limited.length).toBe(8);
  });

  it("gives every code exactly one kind of discount, in whole numbers", () => {
    for (const c of coupons) {
      expect([c.percentOff, c.amountOffPaise].filter((v) => v !== null)).toHaveLength(1);
      if (c.percentOff !== null) {
        expect(c.percentOff).toBeGreaterThanOrEqual(5);
        expect(c.percentOff).toBeLessThanOrEqual(20);
      } else {
        expect(Number.isInteger(c.amountOffPaise)).toBe(true);
      }
    }
    expect(coupons.some((c) => c.percentOff !== null)).toBe(true);
    expect(coupons.some((c) => c.amountOffPaise !== null)).toBe(true);
  });

  it("uses unique codes of a word and a number, all passing the guardrails", () => {
    expect(new Set(coupons.map((c) => c.code)).size).toBe(15);
    for (const c of coupons) {
      expect(c.code).toMatch(/^[A-Z]+\d+$/);
      expect(() => assertAllowed(c.code)).not.toThrow();
      expect(c.isSample).toBe(true);
    }
  });
});

describe("discountFor", () => {
  it("takes a percentage off, rounded down to whole paise", () => {
    expect(discountFor(coupon({ percentOff: 15 }), 99_999)).toBe(14_999);
  });

  it("takes a fixed amount off, but never more than the subtotal", () => {
    expect(discountFor(coupon({ amountOffPaise: 10_000 }), 50_000)).toBe(10_000);
    expect(discountFor(coupon({ amountOffPaise: 10_000 }), 4_900)).toBe(4_900);
  });
});
