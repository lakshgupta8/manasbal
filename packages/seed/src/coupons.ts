import type { Faker } from "@faker-js/faker";
// Prisma reads and writes timestamps as Temporal.Instant, which Node 24 doesn't have yet.
import "temporal-polyfill/global";
import { assertAllowed } from "./guardrails.ts";
import { REFERENCE_DATE } from "./random.ts";

// Exactly one of percentOff and amountOffPaise is set. maxUses is empty for a code with no limit.
export interface CouponRow {
  id: string;
  code: string;
  percentOff: number | null;
  amountOffPaise: number | null;
  validUntil: Temporal.Instant;
  maxUses: number | null;
  isSample: true;
}

// Invented words, one per coupon, so no code looks like a real store's sale.
const WORDS = [
  "MONSOON",
  "LOTUS",
  "CHINAR",
  "SAFFRON",
  "HARVEST",
  "KITE",
  "RANGOLI",
  "WELCOME",
  "LAKESIDE",
  "WINTER",
  "SPRING",
  "FIRSTBUY",
  "HOUSEBOAT",
  "SHIKARA",
  "MEADOW",
];
const ACTIVE = 8;
const EXPIRED = 4;
const USED_UP = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const REFERENCE_MS = Date.parse(REFERENCE_DATE);

const instantAt = (ms: number) => Temporal.Instant.fromEpochMilliseconds(ms);

// About 8 active codes, 4 expired ones and 3 with a usage limit. The limit is only a ceiling
// here: once the orders are made, it is cut down to the number of orders that used the code.
export function generateCoupons(faker: Faker): CouponRow[] {
  const kinds = [
    ...Array<"active">(ACTIVE).fill("active"),
    ...Array<"expired">(EXPIRED).fill("expired"),
    ...Array<"used-up">(USED_UP).fill("used-up"),
  ];
  const words = faker.helpers.shuffle(WORDS);
  return kinds.map((kind, i) => {
    const byPercent = faker.datatype.boolean();
    const percentOff = byPercent ? faker.helpers.arrayElement([5, 10, 15, 20]) : null;
    const rupeesOff = byPercent ? null : faker.helpers.arrayElement([50, 100, 150, 200, 250]);
    const code = `${words[i]}${percentOff ?? rupeesOff}`;
    assertAllowed(code, "coupon code");
    const validUntil =
      kind === "expired"
        ? REFERENCE_MS - faker.number.int({ min: 30, max: 300 }) * DAY_MS
        : REFERENCE_MS + faker.number.int({ min: 30, max: 180 }) * DAY_MS;
    return {
      id: faker.string.uuid(),
      code,
      percentOff,
      amountOffPaise: rupeesOff === null ? null : rupeesOff * 100,
      validUntil: instantAt(validUntil),
      maxUses: kind === "used-up" ? faker.number.int({ min: 3, max: 8 }) : null,
      isSample: true,
    };
  });
}

// The discount on a subtotal in whole paise, rounded down and never more than the subtotal.
export function discountFor(coupon: CouponRow, subtotalPaise: number): number {
  const off =
    coupon.percentOff === null
      ? coupon.amountOffPaise!
      : Math.floor((subtotalPaise * coupon.percentOff) / 100);
  return Math.min(off, subtotalPaise);
}
