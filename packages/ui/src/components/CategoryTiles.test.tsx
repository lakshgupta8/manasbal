import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CategoryTiles, type CategoryTilesLinkProps } from "./CategoryTiles";
import * as stories from "./CategoryTiles.stories";

const { Default, Phone, Dark } = composeStories(stories);

describe("CategoryTiles", () => {
  it.each([Default, Phone, Dark])("lists each category as one link, in order (%#)", (Story) => {
    render(<Story />);

    const links = screen.getAllByRole("link");
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(links.map((link) => link.textContent)).toEqual([
      "Books & Stationery",
      "Clothing",
      "Electronics accessories",
      "Footwear",
      "Home & Kitchen",
      "Toys & Games",
    ]);
    expect(links[1]!.getAttribute("href")).toBe("#clothing");
  });

  it("hides the chevron from assistive tech", () => {
    const { container } = render(<Default />);

    for (const icon of container.querySelectorAll("svg")) {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("takes the caller's link component and class", () => {
    const ShopLink = (props: CategoryTilesLinkProps) => (
      <a href={`/en${props.href}`} className={props.className}>
        {props.children}
      </a>
    );
    render(
      <CategoryTiles
        categories={[{ href: "/c/footwear", name: "Footwear" }]}
        linkAs={ShopLink}
        className="extra"
      />,
    );

    expect(screen.getByRole("list").className).toBe("mb-category-tiles extra");
    expect(screen.getByRole("link").getAttribute("href")).toBe("/en/c/footwear");
  });
});
