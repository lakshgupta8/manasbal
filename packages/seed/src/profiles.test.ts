import { describe, expect, it } from "vitest";
import { PROFILES, getProfile } from "./profiles.ts";

describe("seed profiles", () => {
  it("has the counts the roadmap sets", () => {
    expect(getProfile("minimal")).toMatchObject({ customers: 3, sellers: 2, products: 10 });
    expect(getProfile("demo")).toEqual({
      customers: 300,
      sellers: 30,
      products: 1_200,
      orders: 6_000,
      localOnly: false,
    });
  });

  it("makes load ten times demo, and local only", () => {
    const { demo, load } = PROFILES;

    expect(load).toEqual({
      customers: demo.customers * 10,
      sellers: demo.sellers * 10,
      products: demo.products * 10,
      orders: demo.orders * 10,
      localOnly: true,
    });
  });

  it("refuses a profile that doesn't exist", () => {
    expect(() => getProfile("huge")).toThrow('Unknown seed profile "huge"');
    expect(() => getProfile("toString")).toThrow("Unknown seed profile");
  });
});
