import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeStories } from "@storybook/react-vite";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProductCardLinkProps } from "./ProductCard";
import { ProductGrid } from "./ProductGrid";
import * as stories from "./ProductGrid.stories";

const { One, Three, Eight, EightTablet, TwoPhone, Empty, EightDark, EmptyDark } =
  composeStories(stories);

describe("ProductGrid", () => {
  it.each([
    [One, 1],
    [Three, 3],
    [Eight, 8],
    [EightTablet, 8],
    [TwoPhone, 2],
    [EightDark, 8],
  ])("lists every product as a card, in order (%#)", (Story, count) => {
    render(<Story />);

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(count);
    expect(items.map((item) => within(item).getByRole("article")).length).toBe(count);
    expect(within(items[0]!).getByRole("link").textContent).toBe("Striped cotton tee");
  });

  it("puts the links in reading order, one per card", () => {
    render(<Eight />);

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Striped cotton tee",
      "Handloom shawl in indigo",
      "Brass tea strainer",
      "Linen cushion cover",
      "Block-printed table runner",
      "Clay water bottle",
      "Bamboo pen stand",
      "Handloom cotton kurta with mirror work on the yoke",
    ]);
  });

  it.each([Empty, EmptyDark])("says so when there are no products", (Story) => {
    render(<Story />);

    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText("No products here yet").className).toBe(
      "mb-product-grid mb-product-grid--empty",
    );
  });

  it("takes the empty words, link component, heading level and class from the caller", () => {
    const { unmount } = render(
      <ProductGrid products={[]} emptyLabel="यहाँ अभी कोई सामान नहीं है" className="extra" />,
    );
    expect(screen.getByText("यहाँ अभी कोई सामान नहीं है").className).toBe(
      "mb-product-grid extra mb-product-grid--empty",
    );
    unmount();

    const ShopLink = (props: ProductCardLinkProps) => (
      <a href={`/en${props.href}`} className={props.className}>
        {props.children}
      </a>
    );
    render(
      <ProductGrid
        products={[{ id: "p1", name: "Tee", href: "/products/tee", pricePaise: 100 }]}
        linkAs={ShopLink}
        headingLevel={2}
        className="extra"
      />,
    );
    expect(screen.getByRole("list").className).toBe("mb-product-grid extra");
    expect(screen.getByRole("heading", { level: 2 })).toBeDefined();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/en/products/tee");
  });

  // jsdom has no layout, so the columns are checked in the CSS here and drawn at 375, 768 and
  // 1280 px by the visual tests.
  it("has 1 column, then 2 from 600 px, then 4 from 1024 px, 24 px apart", () => {
    const css = readFileSync(join(import.meta.dirname, "ProductGrid.css"), "utf8");
    const flat = css.replaceAll(/\s+/g, " ");

    expect(flat).toContain(
      ".mb-product-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--mb-space-6);",
    );
    expect(flat).toContain(
      "@media (min-width: 600px) { .mb-product-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }",
    );
    expect(flat).toContain(
      "@media (min-width: 1024px) { .mb-product-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }",
    );
  });
});
