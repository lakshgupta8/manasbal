import { beforeEach, describe, expect, it, vi } from "vitest";
import { CURRENCY_COOKIE, getCurrency, toCurrency } from "./currency";

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  }),
}));

describe("toCurrency", () => {
  it("is USD only for USD, and rupees for anything else", () => {
    expect(toCurrency("USD")).toBe("USD");
    expect(toCurrency("INR")).toBe("INR");
    expect(toCurrency("usd")).toBe("INR");
    expect(toCurrency("EUR")).toBe("INR");
    expect(toCurrency("")).toBe("INR");
    expect(toCurrency(null)).toBe("INR");
    expect(toCurrency(undefined)).toBe("INR");
  });
});

describe("getCurrency", () => {
  beforeEach(() => {
    jar.clear();
  });

  it("reads the visitor's choice from the cookie", async () => {
    jar.set(CURRENCY_COOKIE, "USD");

    await expect(getCurrency()).resolves.toBe("USD");
  });

  it("shows rupees without a cookie", async () => {
    await expect(getCurrency()).resolves.toBe("INR");
  });
});
