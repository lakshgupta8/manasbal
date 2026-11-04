import { describe, expect, it } from "vitest";
import { NEW_ACCOUNT_ROLE, ROLES, roleSchema } from "./roles.js";

describe("roleSchema", () => {
  it("lists the five roles", () => {
    expect(ROLES).toEqual(["customer", "seller", "seller_staff", "support", "admin"]);
  });

  it("refuses any other value, such as the old buyer role", () => {
    expect(roleSchema.safeParse("buyer").success).toBe(false);
    expect(roleSchema.safeParse("admin").success).toBe(true);
  });

  it("starts new accounts as customers", () => {
    expect(NEW_ACCOUNT_ROLE).toBe("customer");
  });
});
