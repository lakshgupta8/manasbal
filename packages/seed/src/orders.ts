import type { Faker } from "@faker-js/faker";
// Prisma reads and writes timestamps as Temporal.Instant, which Node 24 doesn't have yet.
import "temporal-polyfill/global";
import sales from "../data/sales.json" with { type: "json" };
import { insertInBatches } from "./batches.ts";
import { discountFor, type CouponRow } from "./coupons.ts";
import type { createDb } from "./db.ts";
import { assertAllowed } from "./guardrails.ts";
import type { People } from "./people.ts";
import type { Catalog, ReviewText } from "./products.ts";
import type { SeedProfile } from "./profiles.ts";
import { REFERENCE_DATE } from "./random.ts";

// The orm of a client, or of a transaction.
type Orm = ReturnType<typeof createDb>["orm"];

export type OrderStatus = "placed" | "shipped" | "delivered" | "cancelled" | "returned";

// No shipment: shipments aren't seeded yet.
export interface OrderRow {
  id: string;
  userId: string;
  addressId: string;
  couponId: string | null;
  status: OrderStatus;
  totalPaise: number;
  idempotencyKey: string;
  isSample: true;
  createdAt: Temporal.Instant;
}

export interface SubOrderRow {
  id: string;
  orderId: string;
  sellerId: string;
  status: OrderStatus;
  subtotalPaise: number;
  isSample: true;
}

export interface OrderItemRow {
  id: string;
  subOrderId: string;
  variantId: string;
  quantity: number;
  unitPricePaise: number;
  isSample: true;
}

export interface PaymentRow {
  id: string;
  orderId: string;
  status: "captured" | "refunded";
  amountPaise: number;
  gatewayRef: string;
  isSample: true;
  createdAt: Temporal.Instant;
}

export interface ReviewRow {
  id: string;
  orderItemId: string;
  userId: string;
  productId: string;
  rating: number;
  body: string;
  isSample: true;
  createdAt: Temporal.Instant;
}

export interface Orders {
  // The coupons, with each limited code's limit cut down to the orders that used it.
  coupons: CouponRow[];
  orders: OrderRow[];
  subOrders: SubOrderRow[];
  orderItems: OrderItemRow[];
  payments: PaymentRow[];
  reviews: ReviewRow[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const REFERENCE_MS = Date.parse(REFERENCE_DATE);
const DAYS_OF_HISTORY = 365;
// The week before a sale sells about three times as much as a normal day.
const PRE_SALE_DAYS = 7;
const PRE_SALE_WEIGHT = 3;
// Orders this new are still on their way.
const RECENT_DAYS = 7;
const REVIEW_SHARE = 0.2;
// Texts rated 4 or 5 are picked this many times as often as the rest.
const GOOD_REVIEW_WEIGHT = 4;
const COUPON_SHARE = 0.1;

// Sale names are checked like every other text, so a real store's sale name can't slip in.
for (const sale of sales) {
  assertAllowed(sale.name, "sales.json");
}

// Every day of the last twelve months (as the start of the day, in ms), with its weight.
function weightedDays(): { value: number; weight: number }[] {
  const starts = sales.map((sale) => Date.parse(sale.start));
  return Array.from({ length: DAYS_OF_HISTORY }, (_, i) => {
    const day = REFERENCE_MS - (DAYS_OF_HISTORY - i) * DAY_MS;
    const beforeSale = starts.some((start) => day >= start - PRE_SALE_DAYS * DAY_MS && day < start);
    return { value: day, weight: beforeSale ? PRE_SALE_WEIGHT : 1 };
  });
}

// Cancelled about 5% and returned about 4%; the rest is delivered, or still on its way when the
// order is recent (a recent order can't have been returned yet).
function pickStatus(faker: Faker, createdMs: number): OrderStatus {
  if (createdMs > REFERENCE_MS - RECENT_DAYS * DAY_MS) {
    return faker.helpers.weightedArrayElement<OrderStatus>([
      { value: "cancelled", weight: 5 },
      { value: "placed", weight: 47.5 },
      { value: "shipped", weight: 47.5 },
    ]);
  }
  return faker.helpers.weightedArrayElement<OrderStatus>([
    { value: "cancelled", weight: 5 },
    { value: "returned", weight: 4 },
    { value: "delivered", weight: 91 },
  ]);
}

function pickReview(faker: Faker, texts: ReviewText[]): ReviewText {
  return faker.helpers.weightedArrayElement(
    texts.map((text) => ({ value: text, weight: text.rating >= 4 ? GOOD_REVIEW_WEIGHT : 1 })),
  );
}

// One to four different variants, each with a quantity of one to three.
function pickLines(faker: Faker, catalog: Catalog): { variantId: string; quantity: number }[] {
  const count = faker.number.int({ min: 1, max: 4 });
  const chosen = new Set<number>();
  while (chosen.size < count) {
    chosen.add(faker.number.int({ max: catalog.variants.length - 1 }));
  }
  return [...chosen].map((index) => ({
    variantId: catalog.variants[index]!.id,
    quantity: faker.number.int({ min: 1, max: 3 }),
  }));
}

const sum = (numbers: number[]): number => numbers.reduce((total, n) => total + n, 0);

// Map.groupBy, which the ES2023 library this package compiles against doesn't have yet.
function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
}

// Orders over the last twelve months, busier before each sale, each with its sub-orders (one per
// seller), items, payment and, for some delivered items, a review. All money is whole paise.
export function generateOrders(
  faker: Faker,
  profile: SeedProfile,
  people: People,
  catalog: Catalog,
  coupons: CouponRow[],
): Orders {
  const days = weightedDays();
  const addressesByUser = groupBy(people.addresses, (address) => address.userId);
  const variants = new Map(catalog.variants.map((variant) => [variant.id, variant]));
  const products = new Map(catalog.products.map((product) => [product.id, product]));
  const uses = new Map(coupons.map((coupon) => [coupon.id, 0]));
  const result: Orders = {
    coupons: [],
    orders: [],
    subOrders: [],
    orderItems: [],
    payments: [],
    reviews: [],
  };

  // About 10% of orders use a code that was still valid on the order's day, isn't used up and
  // takes less than the whole subtotal off.
  const pickCoupon = (createdMs: number, subtotalPaise: number): CouponRow | null => {
    if (!faker.datatype.boolean({ probability: COUPON_SHARE })) return null;
    const usable = coupons.filter(
      (coupon) =>
        createdMs < coupon.validUntil.epochMilliseconds &&
        (coupon.maxUses === null || uses.get(coupon.id)! < coupon.maxUses) &&
        discountFor(coupon, subtotalPaise) < subtotalPaise,
    );
    if (usable.length === 0) return null;
    const coupon = faker.helpers.arrayElement(usable);
    uses.set(coupon.id, uses.get(coupon.id)! + 1);
    return coupon;
  };

  const bundles = Array.from({ length: profile.orders }, () => {
    const createdMs =
      faker.helpers.weightedArrayElement(days) + faker.number.int({ max: DAY_MS - 1 });
    const createdAt = Temporal.Instant.fromEpochMilliseconds(createdMs);
    const buyer = faker.helpers.arrayElement(people.customers);
    const address = faker.helpers.arrayElement(addressesByUser.get(buyer.id)!);
    const status = pickStatus(faker, createdMs);
    const orderId = faker.string.uuid();

    const lines = pickLines(faker, catalog).map((line) => {
      const variant = variants.get(line.variantId)!;
      return { ...line, variant, product: products.get(variant.productId)! };
    });
    const bySeller = groupBy(lines, (line) => line.product.sellerId);

    const subOrders: SubOrderRow[] = [];
    const orderItems: OrderItemRow[] = [];
    for (const [sellerId, sellerLines] of bySeller) {
      const subOrderId = faker.string.uuid();
      const items = sellerLines.map((line): OrderItemRow => ({
        id: faker.string.uuid(),
        subOrderId,
        variantId: line.variantId,
        quantity: line.quantity,
        unitPricePaise: line.variant.pricePaise,
        isSample: true,
      }));
      orderItems.push(...items);
      subOrders.push({
        id: subOrderId,
        orderId,
        sellerId,
        status,
        subtotalPaise: sum(items.map((item) => item.quantity * item.unitPricePaise)),
        isSample: true,
      });
    }

    // Sellers are paid on the full subtotals; the shop pays for the discount.
    const subtotalPaise = sum(subOrders.map((subOrder) => subOrder.subtotalPaise));
    const coupon = pickCoupon(createdMs, subtotalPaise);
    const totalPaise = subtotalPaise - (coupon ? discountFor(coupon, subtotalPaise) : 0);
    const order: OrderRow = {
      id: orderId,
      userId: buyer.id,
      addressId: address.id,
      couponId: coupon?.id ?? null,
      status,
      totalPaise,
      idempotencyKey: `seed_${faker.string.uuid()}`,
      isSample: true,
      createdAt,
    };
    const payment: PaymentRow = {
      id: faker.string.uuid(),
      orderId,
      status: status === "cancelled" || status === "returned" ? "refunded" : "captured",
      amountPaise: totalPaise,
      gatewayRef: `seed_${faker.string.uuid()}`,
      isSample: true,
      createdAt,
    };

    const reviews: ReviewRow[] = [];
    if (status === "delivered") {
      for (const item of orderItems) {
        if (!faker.datatype.boolean({ probability: REVIEW_SHARE })) continue;
        const productId = variants.get(item.variantId)!.productId;
        const text = pickReview(faker, catalog.reviewTexts[productId]!);
        const reviewedMs = createdMs + faker.number.int({ min: 3, max: 20 }) * DAY_MS;
        reviews.push({
          id: faker.string.uuid(),
          orderItemId: item.id,
          userId: buyer.id,
          productId,
          rating: text.rating,
          body: text.body,
          isSample: true,
          createdAt: Temporal.Instant.fromEpochMilliseconds(Math.min(reviewedMs, REFERENCE_MS)),
        });
      }
    }
    return { order, subOrders, orderItems, payment, reviews };
  });

  // Oldest first, like rows written as they happened.
  bundles.sort((a, b) => Temporal.Instant.compare(a.order.createdAt, b.order.createdAt));
  for (const bundle of bundles) {
    result.orders.push(bundle.order);
    result.subOrders.push(...bundle.subOrders);
    result.orderItems.push(...bundle.orderItems);
    result.payments.push(bundle.payment);
    result.reviews.push(...bundle.reviews);
  }
  result.coupons = coupons.map((coupon) =>
    coupon.maxUses === null ? coupon : { ...coupon, maxUses: uses.get(coupon.id)! },
  );
  return result;
}

// Coupons first, because orders point at them; then orders, because everything else points at
// them; reviews last, because they point at items.
export async function insertOrders(orm: Orm, data: Orders): Promise<void> {
  const db = orm.public;
  await insertInBatches(data.coupons, (batch) => db.Coupon.createAndCount(batch));
  await insertInBatches(data.orders, (batch) => db.Order.createAndCount(batch));
  await insertInBatches(data.subOrders, (batch) => db.SubOrder.createAndCount(batch));
  await insertInBatches(data.orderItems, (batch) => db.OrderItem.createAndCount(batch));
  await insertInBatches(data.payments, (batch) => db.Payment.createAndCount(batch));
  await insertInBatches(data.reviews, (batch) => db.Review.createAndCount(batch));
}
