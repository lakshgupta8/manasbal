import "./Price.css";

export type PriceSize = "large" | "small";

/** INR shows the price itself; USD shows it converted at the demo rate, for display only. */
export type Currency = "INR" | "USD";

/** The words screen readers say for a dollar price, in the page's language. */
export interface DollarWords {
  /** Before the amount, because it is converted: "about". */
  readonly about: string;
  readonly dollars: string;
  readonly cents: string;
}

export interface PriceProps {
  /** The amount in whole paise: a safe, non-negative integer. Anything else throws a TypeError. */
  readonly paise: number;
  readonly size?: PriceSize;
  /** INR (the default) or USD, converted at DEMO_USD_RATE for display only. */
  readonly currency?: Currency;
  /**
   * The word screen readers say after a rupee amount, in the page's language ("rupees", "रुपये").
   * The ₹ sign is read differently by each screen reader, so they hear "1,29,999 rupees" instead.
   */
  readonly unit?: string;
  /** The words screen readers say for a dollar amount: "about 15 dollars 60 cents". */
  readonly dollarWords?: DollarWords;
  readonly className?: string;
}

/**
 * The demo's fixed exchange rate, in paise per US cent: 88 paise to the cent is ₹88 to the dollar.
 * Dollars are for display only: nothing is ever charged or stored in them.
 */
export const DEMO_USD_RATE = 88;

const ENGLISH_DOLLARS: DollarWords = { about: "about", dollars: "dollars", cents: "cents" };

// Always en-IN for rupees and en-US for dollars, whatever the page's language: the grouping each
// currency uses, and the same Latin digits on every page.
const RUPEES = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const DOLLARS = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
// What is spoken: no sign, and no ".00" for whole rupees.
const SPOKEN_RUPEES = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const SPOKEN_WHOLE = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function assertPaise(paise: unknown): asserts paise is number {
  if (typeof paise !== "number" || !Number.isSafeInteger(paise) || paise < 0) {
    const got = typeof paise === "number" ? String(paise) : typeof paise;
    throw new TypeError(`A price is a whole, non-negative number of paise; got ${got}`);
  }
}

// Hundredths as an exact decimal string ("129999.00"): dividing by 100 would round very large
// amounts.
function asDecimal(hundredths: number | bigint): `${number}` {
  const digits = String(hundredths).padStart(3, "0");
  return `${digits.slice(0, -2)}.${digits.slice(-2)}` as `${number}`;
}

/**
 * Whole paise in whole US cents at DEMO_USD_RATE, rounded half up, in integer maths (BigInt, so
 * it stays exact up to Number.MAX_SAFE_INTEGER paise): 137280 paise is 1560 cents ($15.60), and
 * 44 paise, half a cent, is 1 cent.
 */
export function paiseToCents(paise: number): bigint {
  assertPaise(paise);
  const rate = BigInt(DEMO_USD_RATE);
  return (BigInt(paise) * 2n + rate) / (rate * 2n);
}

/** Formats whole paise as rupees with Indian grouping: 12999900 → "₹1,29,999.00". */
export function formatPaise(paise: number): string {
  assertPaise(paise);
  return RUPEES.format(asDecimal(paise));
}

/** Formats whole paise as approximate dollars at DEMO_USD_RATE: 137280 → "≈ $15.60". */
export function formatPaiseInDollars(paise: number): string {
  return `≈ ${DOLLARS.format(asDecimal(paiseToCents(paise)))}`;
}

function spokenDollars(paise: number, words: DollarWords): string {
  const cents = paiseToCents(paise);
  const dollars = SPOKEN_WHOLE.format(cents / 100n);
  const rest = cents % 100n;
  const centsPart = rest === 0n ? "" : ` ${rest} ${words.cents}`;
  return `${words.about} ${dollars} ${words.dollars}${centsPart}`;
}

/** A price from whole paise, in rupees, or approximately in dollars for display. */
export function Price({
  paise,
  size = "small",
  currency = "INR",
  unit = "rupees",
  dollarWords = ENGLISH_DOLLARS,
  className,
}: PriceProps) {
  const inDollars = currency === "USD";
  const shown = inDollars ? formatPaiseInDollars(paise) : formatPaise(paise);
  const spoken = inDollars
    ? spokenDollars(paise, dollarWords)
    : `${SPOKEN_RUPEES.format(asDecimal(paise))} ${unit}`;

  return (
    <data
      value={paise}
      className={["mb-price", `mb-price--${size}`, className].filter(Boolean).join(" ")}
    >
      <span aria-hidden="true">{shown}</span>
      <span className="mb-price__spoken">{spoken}</span>
    </data>
  );
}
