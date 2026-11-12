import "./Price.css";

export type PriceSize = "large" | "small";

export interface PriceProps {
  /** The amount in whole paise: a safe, non-negative integer. Anything else throws a TypeError. */
  readonly paise: number;
  readonly size?: PriceSize;
  /**
   * The word screen readers say after the amount, in the page's language ("rupees", "रुपये").
   * The ₹ sign is read differently by each screen reader, so they hear "1,29,999 rupees" instead.
   */
  readonly unit?: string;
  readonly className?: string;
}

// Always en-IN, whatever the page's language: Indian grouping and the same digits on every page.
const RUPEES = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
// What is spoken: no sign, and no ".00" for whole rupees.
const SPOKEN = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

function assertPaise(paise: unknown): asserts paise is number {
  if (typeof paise !== "number" || !Number.isSafeInteger(paise) || paise < 0) {
    const got = typeof paise === "number" ? String(paise) : typeof paise;
    throw new TypeError(`A price is a whole, non-negative number of paise; got ${got}`);
  }
}

// Paise as an exact decimal string ("129999.00"): dividing by 100 would round very large amounts.
function asRupees(paise: number): `${number}` {
  const digits = String(paise).padStart(3, "0");
  return `${digits.slice(0, -2)}.${digits.slice(-2)}` as `${number}`;
}

/** Formats whole paise as rupees with Indian grouping: 12999900 → "₹1,29,999.00". */
export function formatPaise(paise: number): string {
  assertPaise(paise);
  return RUPEES.format(asRupees(paise));
}

/** A price in rupees, from whole paise. */
export function Price({ paise, size = "small", unit = "rupees", className }: PriceProps) {
  const shown = formatPaise(paise);

  return (
    <data
      value={paise}
      className={["mb-price", `mb-price--${size}`, className].filter(Boolean).join(" ")}
    >
      <span aria-hidden="true">{shown}</span>
      <span className="mb-price__spoken">{`${SPOKEN.format(asRupees(paise))} ${unit}`}</span>
    </data>
  );
}
