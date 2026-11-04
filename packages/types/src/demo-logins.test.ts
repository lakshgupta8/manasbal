import { describe, expect, it } from "vitest";
import { DEMO_EMAILS, isDemoEmail } from "./demo-logins.js";
import { ROLES } from "./roles.js";

describe("DEMO_EMAILS", () => {
  it("has one distinct login per role", () => {
    expect(Object.keys(DEMO_EMAILS).sort()).toEqual([...ROLES].sort());
    expect(new Set(Object.values(DEMO_EMAILS)).size).toBe(ROLES.length);
  });
});

describe("isDemoEmail", () => {
  it.each(Object.values(DEMO_EMAILS))("knows %s", (email) => {
    expect(isDemoEmail(email)).toBe(true);
  });

  it("ignores case and spaces around the email", () => {
    expect(isDemoEmail("  Customer@Example.COM ")).toBe(true);
  });

  it.each(["buyer@example.com", "customer@example.org", "xcustomer@example.com", ""])(
    "says no to %j",
    (email) => {
      expect(isDemoEmail(email)).toBe(false);
    },
  );
});
