import { describe, expect, it, vi } from "vitest";
import sales from "../data/sales.json" with { type: "json" };
import { discountFor, generateCoupons } from "./coupons.ts";
import { generateOrders, insertOrders, type OrderRow, type Orders } from "./orders.ts";
import { generatePeople } from "./people.ts";
import { generateCatalog } from "./products.ts";
import { PROFILES } from "./profiles.ts";
import { createRandom, REFERENCE_DATE } from "./random.ts";

function demoData() {
  const faker = createRandom();
  const people = generatePeople(faker, PROFILES.demo);
  const catalog = generateCatalog(faker, PROFILES.demo, people.sellers);
  const coupons = generateCoupons(faker);
  return { people, catalog, data: generateOrders(faker, PROFILES.demo, people, catalog, coupons) };
}

const { people, catalog, data } = demoData();
const DAY_MS = 24 * 60 * 60 * 1000;
const REFERENCE_MS = Date.parse(REFERENCE_DATE);

const sum = (numbers: number[]) => numbers.reduce((total, n) => total + n, 0);

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return groups;
}

const itemsBySubOrder = groupBy(data.orderItems, (item) => item.subOrderId);
const subOrdersByOrder = groupBy(data.subOrders, (subOrder) => subOrder.orderId);
const variants = new Map(catalog.variants.map((variant) => [variant.id, variant]));
const products = new Map(catalog.products.map((product) => [product.id, product]));
const coupons = new Map(data.coupons.map((coupon) => [coupon.id, coupon]));
// The order total the seed should write: the subtotals, less the coupon's discount.
const expectedTotal = (order: OrderRow) => {
  const subtotal = sum(subOrdersByOrder.get(order.id)!.map((s) => s.subtotalPaise));
  const coupon = order.couponId === null ? undefined : coupons.get(order.couponId);
  return subtotal - (coupon ? discountFor(coupon, subtotal) : 0);
};
const orders = new Map(data.orders.map((order) => [order.id, order]));
const subOrders = new Map(data.subOrders.map((subOrder) => [subOrder.id, subOrder]));
const orderOfItem = new Map(
  data.orderItems.map((item) => {
    return [item.id, orders.get(subOrders.get(item.subOrderId)!.orderId)!];
  }),
);

describe("generateOrders", () => {
  it("makes the profile's number of orders, each with a payment", () => {
    expect(data.orders).toHaveLength(6_000);
    expect(data.payments).toHaveLength(6_000);
    expect(data.orderItems.length).toBeGreaterThan(12_000);
  });

  it("adds every order up: items to sub-orders, sub-orders to the order, the order to its payment", () => {
    const payments = new Map(data.payments.map((payment) => [payment.orderId, payment]));
    for (const subOrder of data.subOrders) {
      const items = itemsBySubOrder.get(subOrder.id)!;
      expect(subOrder.subtotalPaise).toBe(sum(items.map((i) => i.quantity * i.unitPricePaise)));
    }
    for (const order of data.orders) {
      expect(order.totalPaise).toBe(expectedTotal(order));
      expect(payments.get(order.id)!.amountPaise).toBe(order.totalPaise);
      expect(Number.isInteger(order.totalPaise)).toBe(true);
    }
  });

  it("flags every row as sample data and marks every reference as seeded", () => {
    const rows = [
      ...data.orders,
      ...data.subOrders,
      ...data.orderItems,
      ...data.payments,
      ...data.reviews,
    ];
    expect(rows.every((row) => row.isSample)).toBe(true);
    expect(data.payments.every((payment) => payment.gatewayRef.startsWith("seed_"))).toBe(true);
    expect(data.orders.every((order) => order.idempotencyKey.startsWith("seed_"))).toBe(true);
    expect(new Set(data.orders.map((order) => order.idempotencyKey)).size).toBe(6_000);
  });

  it("sends each order to one of its buyer's addresses, with one sub-order per seller", () => {
    const addresses = new Map(people.addresses.map((address) => [address.id, address]));
    for (const order of data.orders) {
      expect(addresses.get(order.addressId)!.userId).toBe(order.userId);
      const sellers = subOrdersByOrder.get(order.id)!.map((s) => s.sellerId);
      expect(new Set(sellers).size).toBe(sellers.length);
    }
    for (const subOrder of data.subOrders) {
      for (const item of itemsBySubOrder.get(subOrder.id)!) {
        expect(products.get(variants.get(item.variantId)!.productId)!.sellerId).toBe(
          subOrder.sellerId,
        );
      }
    }
  });

  it("charges each item its variant's price, 1 to 3 at a time", () => {
    for (const item of data.orderItems) {
      expect(item.unitPricePaise).toBe(variants.get(item.variantId)!.pricePaise);
      expect(item.quantity).toBeGreaterThanOrEqual(1);
      expect(item.quantity).toBeLessThanOrEqual(3);
    }
  });

  it("cancels about 5% and returns about 4% of orders, and refunds them", () => {
    const share = (status: string) =>
      data.orders.filter((order) => order.status === status).length / data.orders.length;
    expect(Math.abs(share("cancelled") - 0.05)).toBeLessThanOrEqual(0.015);
    expect(Math.abs(share("returned") - 0.04)).toBeLessThanOrEqual(0.015);

    const statuses = new Map(data.orders.map((order) => [order.id, order.status]));
    for (const payment of data.payments) {
      const refunded = ["cancelled", "returned"].includes(statuses.get(payment.orderId)!);
      expect(payment.status).toBe(refunded ? "refunded" : "captured");
    }
    for (const subOrder of data.subOrders) {
      expect(subOrder.status).toBe(statuses.get(subOrder.orderId));
    }
  });

  it("delivers everything older than a week, and keeps the last week placed or shipped", () => {
    for (const order of data.orders) {
      const ms = order.createdAt.epochMilliseconds;
      expect(ms).toBeLessThan(REFERENCE_MS);
      expect(ms).toBeGreaterThanOrEqual(REFERENCE_MS - 365 * DAY_MS);
      if (order.status === "cancelled") continue;
      const recent = ms > REFERENCE_MS - 7 * DAY_MS;
      expect(["placed", "shipped"].includes(order.status)).toBe(recent);
    }
    expect(data.orders.some((order) => order.status === "placed")).toBe(true);
  });

  it("sells more per day in the week before each sale", () => {
    const starts = sales.map((sale) => Date.parse(sale.start));
    const preSale = (ms: number) => starts.some((start) => ms >= start - 7 * DAY_MS && ms < start);
    const before = data.orders.filter((o) => preSale(o.createdAt.epochMilliseconds)).length;
    const preSaleDays = starts.length * 7;

    expect(before / preSaleDays).toBeGreaterThan(
      ((data.orders.length - before) / (365 - preSaleDays)) * 2,
    );
  });

  it("reviews about 20% of delivered items, mostly with 4 or 5 stars, in the product's own words", () => {
    const delivered = data.orderItems.filter((i) => orderOfItem.get(i.id)!.status === "delivered");
    expect(Math.abs(data.reviews.length / delivered.length - 0.2)).toBeLessThanOrEqual(0.03);
    expect(data.reviews.filter((r) => r.rating >= 4).length / data.reviews.length).toBeGreaterThan(
      0.7,
    );

    const items = new Map(data.orderItems.map((item) => [item.id, item]));
    for (const review of data.reviews) {
      const item = items.get(review.orderItemId)!;
      const order = orderOfItem.get(item.id)!;
      expect(order.status).toBe("delivered");
      expect(review.userId).toBe(order.userId);
      expect(review.productId).toBe(variants.get(item.variantId)!.productId);
      expect(catalog.reviewTexts[review.productId]).toContainEqual({
        rating: review.rating,
        body: review.body,
      });
      const after = review.createdAt.epochMilliseconds - order.createdAt.epochMilliseconds;
      expect(after).toBeGreaterThan(0);
      expect(review.createdAt.epochMilliseconds).toBeLessThanOrEqual(REFERENCE_MS);
    }
    expect(new Set(data.reviews.map((r) => r.orderItemId)).size).toBe(data.reviews.length);
  });

  it("lists orders oldest first", () => {
    const times = data.orders.map((order) => order.createdAt.epochMilliseconds);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("makes the same first order from the same seed", () => {
    const again = demoData().data;

    expect(again.orders[0]).toEqual(data.orders[0]);
    expect(again.reviews[0]).toEqual(data.reviews[0]);
  });
});

describe("coupons on orders", () => {
  const withCoupon = data.orders.filter((order) => order.couponId !== null);

  it("gives about 10% of orders a coupon", () => {
    expect(Math.abs(withCoupon.length / data.orders.length - 0.1)).toBeLessThanOrEqual(0.02);
  });

  it("only uses a code that was valid on the order's day, and never more than its limit", () => {
    const uses = new Map<string, number>();
    for (const order of withCoupon) {
      const coupon = coupons.get(order.couponId!)!;
      expect(order.createdAt.epochMilliseconds).toBeLessThan(coupon.validUntil.epochMilliseconds);
      uses.set(coupon.id, (uses.get(coupon.id) ?? 0) + 1);
    }
    for (const coupon of data.coupons) {
      if (coupon.maxUses === null) continue;
      expect(uses.get(coupon.id) ?? 0).toBe(coupon.maxUses);
    }
  });

  it("always leaves something to pay", () => {
    expect(withCoupon.every((order) => order.totalPaise > 0)).toBe(true);
  });

  it("skips the coupon when no code is usable", () => {
    const faker = createRandom();
    const few = { ...PROFILES.minimal, orders: 200 };
    const p = generatePeople(faker, few);
    const c = generateCatalog(faker, few, p.sellers);
    const expired = generateCoupons(faker).map((coupon) => ({
      ...coupon,
      validUntil: Temporal.Instant.fromEpochMilliseconds(0),
    }));

    const result = generateOrders(faker, few, p, c, expired);

    expect(result.orders.every((order) => order.couponId === null)).toBe(true);
  });
});

describe("insertOrders", () => {
  it("inserts coupons, orders, sub-orders, items, payments and reviews in that order, in batches of 500", async () => {
    const calls: [string, number][] = [];
    const table = (name: string) => ({
      createAndCount: vi.fn(async (batch: unknown[]) => {
        calls.push([name, batch.length]);
        return batch.length;
      }),
    });
    const orm = {
      public: {
        Coupon: table("Coupon"),
        Order: table("Order"),
        SubOrder: table("SubOrder"),
        OrderItem: table("OrderItem"),
        Payment: table("Payment"),
        Review: table("Review"),
      },
    };

    await insertOrders(orm as unknown as Parameters<typeof insertOrders>[0], data as Orders);

    const order = calls.map(([name]) => name);
    const tables = ["Coupon", "Order", "SubOrder", "OrderItem", "Payment", "Review"];
    for (let i = 1; i < tables.length; i++) {
      expect(order.indexOf(tables[i]!)).toBeGreaterThan(order.lastIndexOf(tables[i - 1]!));
    }
    expect(calls.every(([, size]) => size <= 500)).toBe(true);
    expect(calls.filter(([name]) => name === "Order")).toHaveLength(12);
  });
});
