import type { Faker } from "@faker-js/faker";
// Prisma reads and writes timestamps as Temporal.Instant, which Node 24 doesn't have yet.
import "temporal-polyfill/global";
import type { Orders } from "./orders.ts";
import { REFERENCE_DATE } from "./random.ts";

// The marketplace keeps 10% of every delivered sub-order, in basis points (1/100 of a percent).
export const COMMISSION_BPS = 1_000;

export interface SettlementRow {
  id: string;
  sellerId: string;
  periodStart: Temporal.Instant;
  grossPaise: number;
  commissionPaise: number;
  payoutPaise: number;
  status: "paid" | "pending";
  isSample: true;
  createdAt: Temporal.Instant;
}

// The first moment of the month the time falls in, in UTC.
export function monthStart(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

const nextMonthStart = (ms: number) => {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
};

// One row per seller per month with sales. Only delivered sub-orders count: cancelled and
// returned ones were refunded. Past months are paid; the current month is still pending.
export function generateSettlements(faker: Faker, data: Orders): SettlementRow[] {
  const currentMonth = monthStart(Date.parse(REFERENCE_DATE));
  const orderTimes = new Map(
    data.orders.map((order) => [order.id, order.createdAt.epochMilliseconds]),
  );
  const gross = new Map<string, { sellerId: string; periodMs: number; paise: number }>();
  for (const subOrder of data.subOrders) {
    if (subOrder.status !== "delivered") continue;
    const periodMs = monthStart(orderTimes.get(subOrder.orderId)!);
    const key = `${subOrder.sellerId}|${periodMs}`;
    const entry = gross.get(key) ?? { sellerId: subOrder.sellerId, periodMs, paise: 0 };
    entry.paise += subOrder.subtotalPaise;
    gross.set(key, entry);
  }

  return [...gross.values()].map(({ sellerId, periodMs, paise }) => {
    const commissionPaise = Math.round((paise * COMMISSION_BPS) / 10_000);
    const paid = periodMs < currentMonth;
    return {
      id: faker.string.uuid(),
      sellerId,
      periodStart: Temporal.Instant.fromEpochMilliseconds(periodMs),
      grossPaise: paise,
      commissionPaise,
      payoutPaise: paise - commissionPaise,
      status: paid ? "paid" : "pending",
      isSample: true,
      // A month is settled once it ends; the current one was last worked out today.
      createdAt: Temporal.Instant.fromEpochMilliseconds(
        paid ? nextMonthStart(periodMs) : Date.parse(REFERENCE_DATE),
      ),
    };
  });
}
