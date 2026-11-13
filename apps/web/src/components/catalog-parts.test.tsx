import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CategoryLinks, Products } from "./catalog-parts";

const WORDS = {
  sample: "Sample",
  rupees: "rupees",
  empty: "No products here yet",
  about: "about",
  dollars: "dollars",
  cents: "cents",
};
const product = (slug: string, pricePaise: number | null) => ({
  id: `1a2b3c4d-0000-4000-8000-${slug.length.toString().padStart(12, "0")}`,
  slug,
  name: slug.replaceAll("-", " "),
  pricePaise,
  category: { slug: "shirts", name: "Shirts" },
});

describe("Products", () => {
  it("shows each product as a card linking to its page, marked as sample data", () => {
    render(
      <Products
        locale="en"
        words={WORDS}
        products={[product("linen-shirt", 129900), product("cotton-shirt", null)]}
      />,
    );

    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByRole("heading", { level: 3 }).textContent).toBe("linen shirt");
    expect(within(cards[0]!).getByRole("link").getAttribute("href")).toBe("/en/p/linen-shirt");
    expect(within(cards[0]!).getByText("₹1,299.00")).toBeDefined();
    expect(within(cards[0]!).getByText("1,299 rupees")).toBeDefined();
    expect(within(cards[0]!).getByText("Sample")).toBeDefined();
    // A product with no variants yet has no price to show.
    expect(cards[1]!.querySelector("data")).toBeNull();
  });

  it("uses the page's heading level and its empty words", () => {
    const { unmount } = render(
      <Products locale="hi" words={WORDS} products={[product("tee", 100)]} headingLevel={2} />,
    );
    expect(screen.getByRole("heading", { level: 2 })).toBeDefined();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/hi/p/tee");
    unmount();

    render(<Products locale="en" words={WORDS} products={[]} />);
    expect(screen.getByText("No products here yet")).toBeDefined();
  });
});

describe("CategoryLinks", () => {
  it("links each category to its page", () => {
    render(
      <CategoryLinks
        locale="hi"
        categories={[
          {
            id: "1a2b3c4d-0000-4000-8000-000000000001",
            name: "Shoes",
            slug: "shoes",
            children: [],
          },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Shoes" }).getAttribute("href")).toBe("/hi/c/shoes");
  });
});
