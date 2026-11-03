import { verify } from "@node-rs/argon2";
import { ROLES } from "@manasbal/types";
import { describe, expect, it, vi } from "vitest";
import places from "../data/places.json" with { type: "json" };
import { assertAllowed } from "./guardrails.ts";
import { DEMO_EMAILS, DEMO_PASSWORD } from "./demo-logins.ts";
import {
  allUsers,
  generatePeople,
  insertPeople,
  sellerShares,
  withDemoPasswords,
  type People,
} from "./people.ts";
import { PROFILES } from "./profiles.ts";
import { createRandom } from "./random.ts";

const demo = generatePeople(createRandom(), PROFILES.demo);
const users = allUsers(demo);
const demoEmails = new Set(Object.values(DEMO_EMAILS));
const rows = [...users, ...demo.sellers, ...demo.addresses];

describe("generatePeople", () => {
  it("makes the profile's number of customers and sellers", () => {
    expect(demo.customers).toHaveLength(300);
    expect(demo.sellerUsers).toHaveLength(30);
    expect(demo.sellers).toHaveLength(30);
  });

  it("uses only @example.com emails, each one different", () => {
    for (const user of users) {
      expect(user.email).toMatch(/^[a-z0-9.-]+@example\.com$/);
    }
    expect(new Set(users.map((user) => user.email)).size).toBe(users.length);
  });

  it("flags every row as sample data", () => {
    expect(rows.every((row) => row.isSample)).toBe(true);
  });

  it("leaves every password hash empty until the users are written", () => {
    expect(users.every((user) => user.passwordHash === "")).toBe(true);
  });

  it("makes one confirmed demo login per role, with the role's public email", () => {
    const logins = users.filter((user) => demoEmails.has(user.email));

    expect(logins.map((user) => user.role).sort()).toEqual([...ROLES].sort());
    for (const login of logins) {
      expect(login.email).toBe(DEMO_EMAILS[login.role]);
      expect(login.emailVerifiedAt).not.toBeNull();
      expect(login.isSample).toBe(true);
    }
    // Everyone else stays unconfirmed, with no password.
    expect(users.filter((user) => user.emailVerifiedAt !== null)).toHaveLength(5);
  });

  it("makes the first customer and the biggest seller the demo customer and seller", () => {
    expect(demo.customers[0]?.email).toBe("customer@example.com");
    expect(demo.sellerUsers[0]?.email).toBe("seller@example.com");
    expect(demo.sellers[0]?.userId).toBe(demo.sellerUsers[0]?.id);
    expect(demo.addresses.some((address) => address.userId === demo.customers[0]?.id)).toBe(true);
    expect(demo.staff.map((user) => user.role)).toEqual(["seller_staff", "support", "admin"]);
  });

  it("makes the same first customer from the same seed", () => {
    const again = generatePeople(createRandom(), PROFILES.demo);

    expect(again.customers[0]).toEqual(demo.customers[0]);
    expect(again.sellers[0]).toEqual(demo.sellers[0]);
  });

  it("gives every customer one or two addresses, the first one the default", () => {
    for (const customer of demo.customers) {
      const own = demo.addresses.filter((address) => address.userId === customer.id);

      expect(own.length).toBeGreaterThanOrEqual(1);
      expect(own.length).toBeLessThanOrEqual(2);
      expect(own.map((address) => address.isDefault)).toEqual([true, false].slice(0, own.length));
    }
  });

  it("puts each address in a city of its state, with a 6-digit pincode from that state", () => {
    for (const address of demo.addresses) {
      const place = places.find((candidate) => candidate.state === address.state)!;

      expect(place.cities).toContain(address.city);
      expect(address.pincode).toMatch(/^[1-9]\d{5}$/);
      expect(place.pincodePrefixes).toContain(Number(address.pincode.slice(0, 3)));
      expect(address).not.toHaveProperty("phone");
    }
  });

  it("gives each seller its own user, store name and slug, all passing the guardrails", () => {
    const sellerUserIds = new Set(demo.sellerUsers.map((user) => user.id));

    expect(demo.sellerUsers.every((user) => user.role === "seller")).toBe(true);
    expect(demo.customers.every((user) => user.role === "customer")).toBe(true);
    expect(new Set(demo.sellers.map((seller) => seller.userId))).toEqual(sellerUserIds);
    expect(new Set(demo.sellers.map((seller) => seller.storeName)).size).toBe(30);
    for (const seller of demo.sellers) {
      expect(seller.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(() => assertAllowed(seller.storeName, seller.slug)).not.toThrow();
    }
  });

  it("refuses more sellers than there are store names", () => {
    expect(() => generatePeople(createRandom(), { ...PROFILES.minimal, sellers: 321 })).toThrow(
      "Only 320 store names exist",
    );
  });
});

describe("sellerShares", () => {
  it("gives the first seller the biggest share and the rest a falling long tail", () => {
    const shares = sellerShares(30);

    expect(shares[0]).toBeGreaterThan(0.2);
    expect(shares.slice(1).every((share, i) => share < shares[i]!)).toBe(true);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(1);
  });
});

describe("withDemoPasswords", () => {
  it("gives each demo login its own argon2id hash of the public password, and no one else", async () => {
    const minimal = allUsers(generatePeople(createRandom(), PROFILES.minimal));

    const hashed = await withDemoPasswords(minimal);

    const logins = hashed.filter((user) => demoEmails.has(user.email));
    expect(logins).toHaveLength(5);
    for (const login of logins) {
      expect(login.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
      await expect(verify(login.passwordHash, DEMO_PASSWORD)).resolves.toBe(true);
      await expect(verify(login.passwordHash, "wrong-password-here")).resolves.toBe(false);
    }
    // A random salt each: no two demo logins share a hash.
    expect(new Set(logins.map((user) => user.passwordHash)).size).toBe(5);
    expect(
      hashed
        .filter((user) => !demoEmails.has(user.email))
        .every((user) => user.passwordHash === ""),
    ).toBe(true);
  });
});

describe("insertPeople", () => {
  it("inserts users first, then sellers and addresses, in batches of 500", async () => {
    const calls: [string, number][] = [];
    const table = (name: string) => ({
      createAndCount: vi.fn(async (batch: unknown[]) => {
        calls.push([name, batch.length]);
        return batch.length;
      }),
    });
    const orm = {
      public: { User: table("User"), Seller: table("Seller"), Address: table("Address") },
    };
    const load = generatePeople(createRandom(), PROFILES.load);

    await insertPeople(orm as unknown as Parameters<typeof insertPeople>[0], load as People);

    const users = allUsers(load).length;
    expect(calls.filter(([name]) => name === "User")).toHaveLength(Math.ceil(users / 500));
    expect(calls.every(([, size]) => size <= 500)).toBe(true);
    expect(calls.map(([name]) => name).indexOf("Seller")).toBeGreaterThan(
      calls.map(([name]) => name).lastIndexOf("User"),
    );
    expect(calls.at(-1)?.[0]).toBe("Address");
  });
});
