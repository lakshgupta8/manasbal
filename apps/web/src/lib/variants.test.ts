import { describe, expect, it } from "vitest";
import {
  chooseVariant,
  defaultVariant,
  optionsOf,
  variantAddress,
  variantFromForm,
  variantFromSku,
  type Variant,
} from "./variants";

let n = 0;
const variant = (size: string | null, colour: string | null, available = 10): Variant => {
  n += 1;
  return {
    variantId: `1a2b3c4d-0000-4000-8000-${String(n).padStart(12, "0")}`,
    sku: `SKU-00001-${n}`,
    size,
    colour,
    available,
    pricePaise: 49900,
  };
};

describe("defaultVariant", () => {
  it("is the first variant in stock, else the first, else none", () => {
    const out = variant("S", null, 0);
    const last = variant("M", null, 3);
    expect(defaultVariant([out, last])).toBe(last);
    expect(defaultVariant([out])).toBe(out);
    expect(defaultVariant([])).toBeUndefined();
  });
});

describe("optionsOf", () => {
  it("lists each value once, in order, and skips variants without one", () => {
    const variants = [variant("M", "Red"), variant("S", "Red"), variant("M", "Blue")];
    expect(optionsOf(variants, "size")).toEqual([
      { value: "M", available: true },
      { value: "S", available: true },
    ]);
    expect(optionsOf(variants, "colour").map((o) => o.value)).toEqual(["Red", "Blue"]);
    expect(optionsOf([variant(null, "Red")], "size")).toEqual([]);
  });

  it("makes a value unavailable only when every variant with it is out of stock", () => {
    const variants = [
      variant("S", "Red", 0),
      variant("S", "Blue", 4),
      variant("L", "Red", 0),
      variant("L", "Blue", 0),
    ];
    expect(optionsOf(variants, "size")).toEqual([
      { value: "S", available: true },
      { value: "L", available: false },
    ]);
    expect(optionsOf(variants, "colour")).toEqual([
      { value: "Red", available: false },
      { value: "Blue", available: true },
    ]);
  });
});

describe("chooseVariant", () => {
  it("keeps the other picker's value when that combination exists, even out of stock", () => {
    const sRed = variant("S", "Red");
    const mRed = variant("M", "Red", 0);
    const mBlue = variant("M", "Blue");
    expect(chooseVariant([sRed, mRed, mBlue], sRed, "size", "M")).toBe(mRed);
    expect(chooseVariant([sRed, mRed, mBlue], mRed, "colour", "Blue")).toBe(mBlue);
  });

  it("never strands the visitor: with only S·Red and M·Blue, every value can be reached", () => {
    const sRed = variant("S", "Red");
    const mBlue = variant("M", "Blue");
    const both = [sRed, mBlue];

    // M while Red is chosen: there is no M·Red, so the colour follows to Blue.
    expect(chooseVariant(both, sRed, "size", "M")).toBe(mBlue);
    // Blue while S is chosen: no S·Blue, so the size follows to M.
    expect(chooseVariant(both, sRed, "colour", "Blue")).toBe(mBlue);
    // And back again.
    expect(chooseVariant(both, mBlue, "size", "S")).toBe(sRed);
    expect(chooseVariant(both, mBlue, "colour", "Red")).toBe(sRed);
  });

  it("falls back to the first variant in stock with the value, then the first of all", () => {
    const sRed = variant("S", "Red");
    const mGreen = variant("M", "Green", 0);
    const mBlue = variant("M", "Blue");
    const lGreen = variant("L", "Green", 0);
    expect(chooseVariant([sRed, mGreen, mBlue], sRed, "size", "M")).toBe(mBlue);
    expect(chooseVariant([sRed, lGreen], sRed, "size", "L")).toBe(lGreen);
  });

  it("stays put for a value no variant has", () => {
    const sRed = variant("S", "Red");
    expect(chooseVariant([sRed], sRed, "size", "XXL")).toBe(sRed);
  });
});

describe("variantFromSku", () => {
  const first = variant("S", "Red", 0);
  const second = variant("M", "Red", 5);
  const variants = [first, second];

  it("is the variant whose SKU the address names, even out of stock", () => {
    expect(variantFromSku(variants, { variant: second.sku })).toBe(second);
    expect(variantFromSku(variants, { variant: first.sku })).toBe(first);
  });

  it("falls back to the first variant in stock for a SKU that isn't this product's", () => {
    expect(variantFromSku(variants, { variant: "SKU-99999-9" })).toBe(second);
    expect(variantFromSku(variants, { variant: "" })).toBe(second);
    expect(variantFromSku(variants, { variant: [first.sku, second.sku] })).toBe(second);
    expect(variantFromSku(variants, {})).toBe(second);
  });

  it("is undefined for a product with no variants", () => {
    expect(variantFromSku([], { variant: "SKU-00001-1" })).toBeUndefined();
  });
});

describe("variantFromForm", () => {
  const sRed = variant("S", "Red");
  const mRed = variant("M", "Red", 0);
  const mBlue = variant("M", "Blue");
  const variants = [sRed, mRed, mBlue];

  it("is undefined unless the form sent a size or a colour", () => {
    expect(variantFromForm(variants, {})).toBeUndefined();
    expect(variantFromForm(variants, { variant: sRed.sku, size: "" })).toBeUndefined();
    expect(variantFromForm([], { size: "S" })).toBeUndefined();
  });

  it("is the combination sent, even out of stock", () => {
    expect(variantFromForm(variants, { size: "M", colour: "Red" })).toBe(mRed);
    expect(variantFromForm(variants, { size: "M", colour: "Blue" })).toBe(mBlue);
  });

  it("reads one picker when the form sent only that one", () => {
    expect(variantFromForm(variants, { size: "M" })).toBe(mRed);
    expect(variantFromForm(variants, { colour: "Blue" })).toBe(mBlue);
  });

  it("follows the size when the combination doesn't exist, then the colour", () => {
    expect(variantFromForm(variants, { size: "S", colour: "Blue" })).toBe(sRed);
    expect(variantFromForm(variants, { size: "XXL", colour: "Blue" })).toBe(sRed);
    expect(variantFromForm(variants, { colour: "Green" })).toBe(sRed);
  });
});

describe("variantAddress", () => {
  it("names the variant by its SKU", () => {
    expect(variantAddress("/en/p/a-shirt", variant("S", null))).toMatch(
      /^\/en\/p\/a-shirt\?variant=SKU-00001-\d+$/,
    );
  });
});
