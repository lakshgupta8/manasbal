"use client";

import { VariantPicker } from "@manasbal/ui";
import { useState, type ReactNode } from "react";
import {
  chooseVariant,
  inStock,
  optionsOf,
  variantAddress,
  type Variant,
  type VariantKey,
} from "@/lib/variants";

export interface ProductChoiceWords {
  readonly choose: string;
  readonly size: string;
  readonly colour: string;
  readonly notAvailable: string;
  readonly inStock: string;
  readonly outOfStock: string;
}

export interface ProductChoiceProps {
  // At least one.
  readonly variants: readonly Variant[];
  readonly chosen: Variant;
  // This page's path, without the query: where the form goes, and where the address is written.
  readonly path: string;
  // Each variant's price, drawn on the server and keyed by SKU, so the price formatting (and the
  // visitor's currency) stays out of the browser's code.
  readonly prices: Readonly<Record<string, ReactNode>>;
  // The form's submit button, for when JavaScript is off; drawn on the server for the same reason.
  readonly submit: ReactNode;
  // In the page's language.
  readonly words: ProductChoiceWords;
}

// The chosen variant's price, the size and colour pickers, and whether it is in stock, in words.
// With JavaScript, a pick changes them on the spot and replaces the address with ?variant=<sku>
// (no new history entry, no trip to the server: the page has every variant already). Without
// it, the pickers are a form that GETs ?size=&colour= with the Show button, and the server
// answers with the ?variant= address.
export function ProductChoice({
  variants,
  chosen,
  path,
  prices,
  submit,
  words,
}: ProductChoiceProps) {
  const [variant, setVariant] = useState(chosen);

  function pick(key: VariantKey, value: string) {
    const next = chooseVariant(variants, variant, key, value);
    setVariant(next);
    window.history.replaceState(null, "", variantAddress(path, next));
  }

  const pickers = (
    [
      ["size", words.size],
      ["colour", words.colour],
    ] as const
  )
    .map(([key, legend]) => ({ key, legend, options: optionsOf(variants, key) }))
    .filter(({ options }) => options.length > 0);

  return (
    <form action={path} method="get" aria-label={words.choose} className="flex flex-col gap-6">
      {prices[variant.sku]}
      {pickers.map(({ key, legend, options }) => (
        <VariantPicker
          key={key}
          legend={legend}
          name={key}
          // "" matches no option: a variant with no value for a picker the others have.
          value={variant[key] ?? ""}
          onChange={(value) => pick(key, value)}
          unavailableLabel={words.notAvailable}
          options={options.map((option) => ({
            value: option.value,
            label: option.value,
            available: option.available,
          }))}
        />
      ))}
      {pickers.length > 0 && <noscript>{submit}</noscript>}
      <output className="text-body font-medium">
        {inStock(variant) ? words.inStock : words.outOfStock}
      </output>
    </form>
  );
}
