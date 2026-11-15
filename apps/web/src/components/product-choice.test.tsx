import { Price } from "@manasbal/ui";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Variant } from "@/lib/variants";
import { MESSAGES } from "@/test/intl";
import { ProductChoice, type ProductChoiceWords } from "./product-choice";

const wordsOf = (locale: "en" | "hi"): ProductChoiceWords => {
  const p = MESSAGES[locale].Product;
  return {
    choose: p.choose,
    size: p.size,
    colour: p.colour,
    notAvailable: p.notAvailable,
    inStock: p.inStock,
    outOfStock: p.outOfStock,
  };
};
const WORDS = wordsOf("en");

const variant = (
  n: number,
  size: string | null,
  colour: string | null,
  available: number,
  pricePaise = 49900,
): Variant => ({
  variantId: `1a2b3c4d-0000-4000-8000-00000000000${n}`,
  sku: `SKU-00007-${n}`,
  size,
  colour,
  available,
  pricePaise,
});

const S_RED = variant(1, "S", "Red", 8);
const M_BLUE = variant(2, "M", "Blue", 3, 59900);
const L_RED = variant(3, "L", "Red", 0);
const PATH = "/en/p/a-kurta";

const radio = (name: string) => screen.getByRole("radio", { name }) as HTMLInputElement;
const stock = () => screen.getByRole("status").textContent;

function show(variants: readonly Variant[], chosen: Variant, words = WORDS) {
  return render(
    <ProductChoice
      variants={variants}
      chosen={chosen}
      path={PATH}
      // What the page draws on the server for each variant.
      prices={Object.fromEntries(
        variants.map((v) => [v.sku, <Price key={v.sku} paise={v.pricePaise} />]),
      )}
      submit={<button type="submit">Show</button>}
      words={words}
    />,
  );
}

let replaceState: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  replaceState = vi.spyOn(window.history, "replaceState");
});
afterEach(() => {
  replaceState.mockRestore();
});

describe("ProductChoice", () => {
  it("shows the chosen variant's price, its size and colour, and that it is in stock", () => {
    show([S_RED, M_BLUE, L_RED], S_RED);

    expect(screen.getByRole("group", { name: "Size" })).toBeDefined();
    expect(screen.getByRole("group", { name: "Colour" })).toBeDefined();
    expect(radio("S").checked).toBe(true);
    expect(radio("Red").checked).toBe(true);
    expect(stock()).toBe("In stock");
    expect(screen.getByText("₹499.00")).toBeDefined();
  });

  it("disables a size every variant of which is out of stock, and says so", () => {
    show([S_RED, M_BLUE, L_RED], S_RED);

    expect(radio("L (not available)").disabled).toBe(true);
    // Red is still in stock as S·Red, so it can be chosen.
    expect(radio("Red").disabled).toBe(false);
  });

  it("changes the price, the other picker and the address when a size is picked", () => {
    show([S_RED, M_BLUE, L_RED], S_RED);

    fireEvent.click(radio("M"));

    // There is no M·Red, so the colour follows to Blue.
    expect(radio("M").checked).toBe(true);
    expect(radio("Blue").checked).toBe(true);
    expect(screen.getByText("₹599.00")).toBeDefined();
    expect(replaceState).toHaveBeenCalledWith(null, "", `${PATH}?variant=SKU-00007-2`);
    expect(window.location.search).toBe("?variant=SKU-00007-2");
  });

  it("says out of stock when the chosen combination has none left", () => {
    const lBlue = variant(4, "L", "Blue", 5);
    show([S_RED, M_BLUE, L_RED, lBlue], lBlue);

    fireEvent.click(radio("Red"));

    expect(radio("L").checked).toBe(true);
    expect(stock()).toBe("Out of stock");
    expect(replaceState).toHaveBeenLastCalledWith(null, "", `${PATH}?variant=SKU-00007-3`);
  });

  it("is a form that sends the pickers to this page, with Show only for no JavaScript", () => {
    const { container } = show([S_RED, M_BLUE], S_RED);

    const form = screen.getByRole("form", { name: "Choose an option" }) as HTMLFormElement;
    expect(form.getAttribute("action")).toBe(PATH);
    expect(form.getAttribute("method")).toBe("get");
    expect([...new FormData(form).entries()]).toEqual([
      ["size", "S"],
      ["colour", "Red"],
    ]);
    expect(container.querySelector("noscript")).not.toBeNull();
  });

  it("shows only the pickers the product has", () => {
    show([variant(5, "S", null, 1), variant(6, "M", null, 1)], variant(5, "S", null, 1));

    expect(screen.getByRole("group", { name: "Size" })).toBeDefined();
    expect(screen.queryByRole("group", { name: "Colour" })).toBeNull();
  });

  it("shows no pickers and no Show button for a product with one plain variant", () => {
    const only = variant(7, null, null, 0);
    const { container } = show([only], only);

    expect(screen.queryAllByRole("radio")).toEqual([]);
    expect(container.querySelector("noscript")).toBeNull();
    expect(stock()).toBe("Out of stock");
  });

  it("chooses nothing in a picker the chosen variant has no value for", () => {
    const plain = variant(8, null, "Red", 2);
    show([variant(9, "S", "Blue", 1), plain], plain);

    expect(radio("S").checked).toBe(false);
    expect(radio("Red").checked).toBe(true);
  });

  it("speaks Hindi on a Hindi page", () => {
    const words = wordsOf("hi");
    show([S_RED, L_RED], S_RED, words);

    expect(screen.getByRole("group", { name: words.size })).toBeDefined();
    expect(radio(`L ${words.notAvailable}`).disabled).toBe(true);
    expect(stock()).toBe(words.inStock);
  });
});
