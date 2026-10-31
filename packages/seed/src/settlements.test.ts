import { describe, expect, it } from "vitest";
import { generateDataset } from "./dataset.ts";
import { PROFILES } from "./profiles.ts";
import { REFERENCE_DATE } from "./random.ts";
import { COMMISSION_BPS, monthStart } from "./settlements.ts";

const { orders, settlements } = generateDataset(PROFILES.demo);
const sum = (numbers: number[]) => numbers.reduce((total, n) => total + n, 0);

describe("generateSettlements", () => {
  it("splits every gross amount into commission and payout at the named rate", () => {
    expect(COMMISSION_BPS).toBe(1_000);
    for (const row of settlements) {
      expect(row.commissionPaise + row.payoutPaise).toBe(row.grossPaise);
      expect(row.commissionPaise).toBe(Math.round(row.grossPaise / 10));
      expect(row.isSample).toBe(true);
    }
  });

  it("pays each seller on exactly their delivered sub-orders, nothing lost or counted twice", () => {
    const delivered = orders.subOrders.filter((subOrder) => subOrder.status === "delivered");
    for (const sellerId of new Set(delivered.map((s) => s.sellerId))) {
      const sold = sum(
        delivered.filter((s) => s.sellerId === sellerId).map((s) => s.subtotalPaise),
      );
      const settled = sum(
        settlements.filter((r) => r.sellerId === sellerId).map((r) => r.grossPaise),
      );
      expect(settled).toBe(sold);
    }
  });

  it("has one row per seller and month, starting at midnight UTC on the 1st", () => {
    const keys = settlements.map((r) => `${r.sellerId}|${r.periodStart.epochMilliseconds}`);
    expect(new Set(keys).size).toBe(settlements.length);
    for (const row of settlements) {
      expect(row.periodStart.toString()).toMatch(/^\d{4}-\d{2}-01T00:00:00Z$/);
    }
  });

  it("marks past months paid and the current month pending", () => {
    const current = monthStart(Date.parse(REFERENCE_DATE));
    for (const row of settlements) {
      const isCurrent = row.periodStart.epochMilliseconds === current;
      expect(row.status).toBe(isCurrent ? "pending" : "paid");
      expect(row.createdAt.epochMilliseconds).toBeGreaterThan(row.periodStart.epochMilliseconds);
    }
    expect(settlements.some((row) => row.status === "pending")).toBe(true);
  });
});
