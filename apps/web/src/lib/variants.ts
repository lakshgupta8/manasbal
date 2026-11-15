import type { ProductDetail } from "@manasbal/sdk";

// How a product page picks among a product's variants. No API calls here: the product page's
// client part imports these, and must not bring the API client into the browser.

export type Variant = ProductDetail["variants"][number];
// The two ways a product's variants differ.
export type VariantKey = "size" | "colour";

export function inStock(variant: Variant): boolean {
  return variant.available > 0;
}

// The variant shown when the address doesn't name one: the first that can be bought, or the
// first of all when none can. undefined only for a product with no variants.
export function defaultVariant(variants: readonly Variant[]): Variant | undefined {
  return variants.find(inStock) ?? variants[0];
}

// One picker's options: each value the product has, in order, once. A value can be chosen while
// at least one variant with it is in stock. Empty when no variant has a value for this key.
export interface VariantOption {
  readonly value: string;
  readonly available: boolean;
}

export function optionsOf(variants: readonly Variant[], key: VariantKey): VariantOption[] {
  const options = new Map<string, boolean>();
  for (const variant of variants) {
    const value = variant[key];
    if (value !== null) options.set(value, (options.get(value) ?? false) || inStock(variant));
  }
  return [...options].map(([value, available]) => ({ value, available }));
}

const OTHER: Record<VariantKey, VariantKey> = { size: "colour", colour: "size" };

// The variant after the visitor picks a value in one picker. The other picker keeps its value
// when that combination exists (even out of stock, so the page can say so). When it doesn't, the
// first in-stock variant with the new value is chosen, and the other picker follows: with only
// S·Red and M·Blue, picking M while Red is chosen gives M·Blue rather than a dead end.
export function chooseVariant(
  variants: readonly Variant[],
  current: Variant,
  key: VariantKey,
  value: string,
): Variant {
  const other = OTHER[key];
  const withValue = variants.filter((variant) => variant[key] === value);
  return (
    withValue.find((variant) => variant[other] === current[other]) ??
    withValue.find(inStock) ??
    withValue[0] ??
    current
  );
}

// What the address can carry: ?variant=<sku> from the page's script, or ?size=&colour= from the
// pickers' form when JavaScript is off.
export interface VariantSearch {
  readonly variant?: string | string[];
  readonly size?: string | string[];
  readonly colour?: string | string[];
}

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

// The variant the address asks for. A SKU that isn't this product's falls back to the default,
// as does a missing one. An out-of-stock SKU stays chosen, so the page says it's out of stock.
export function variantFromSku(
  variants: readonly Variant[],
  search: VariantSearch,
): Variant | undefined {
  const sku = one(search.variant);
  return variants.find((variant) => variant.sku === sku) ?? defaultVariant(variants);
}

// The variant the pickers' form sent, or undefined when it sent neither picker. Both values when
// that combination exists; otherwise the first in-stock variant with the size, then the colour.
export function variantFromForm(
  variants: readonly Variant[],
  search: VariantSearch,
): Variant | undefined {
  const size = one(search.size);
  const colour = one(search.colour);
  let picked: { readonly key: VariantKey; readonly value: string } | undefined;
  if (size !== undefined) picked = { key: "size", value: size };
  else if (colour !== undefined) picked = { key: "colour", value: colour };
  const start = defaultVariant(variants);
  if (picked === undefined || start === undefined) return undefined;
  const exact = variants.find(
    (variant) =>
      (size === undefined || variant.size === size) &&
      (colour === undefined || variant.colour === colour),
  );
  return exact ?? chooseVariant(variants, start, picked.key, picked.value);
}

// The address with this variant chosen: what the page's script writes, replacing the entry.
export function variantAddress(path: string, variant: Variant): string {
  return `${path}?${new URLSearchParams({ variant: variant.sku }).toString()}`;
}
