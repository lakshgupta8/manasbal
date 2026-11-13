import { composeStories } from "@storybook/react-vite";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Breadcrumbs, type BreadcrumbsLinkProps } from "./Breadcrumbs";
import * as stories from "./Breadcrumbs.stories";

const { Default, OneLevel, Phone, Dark } = composeStories(stories);

describe("Breadcrumbs", () => {
  it("is a named navigation with an ordered list down to the current page", () => {
    render(<Default />);

    const nav = screen.getByRole("navigation", { name: "Breadcrumbs" });
    const list = within(nav).getByRole("list");
    expect(list.tagName).toBe("OL");
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Home", "Clothing", "Men", "Shirts"]);
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["#home", "#clothing", "#clothing-men"]);
  });

  it("marks the current page and does not link it", () => {
    render(<Default />);

    const current = screen.getByText("Shirts");
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(current.closest("a")).toBeNull();
  });

  it("has no separator text for screen readers to read", () => {
    render(<Default />);

    expect(screen.getByRole("navigation").textContent).toBe("HomeClothingMenShirts");
  });

  it.each([
    [OneLevel, 2],
    [Phone, 4],
    [Dark, 4],
  ])("draws every crumb (%#)", (Story, count) => {
    render(<Story />);

    expect(screen.getAllByRole("listitem")).toHaveLength(count);
  });

  it("takes the caller's name, link component and class", () => {
    const ShopLink = (props: BreadcrumbsLinkProps) => (
      <a href={`/hi${props.href}`} className={props.className}>
        {props.children}
      </a>
    );
    render(
      <Breadcrumbs
        trail={[{ href: "/", label: "होम" }]}
        current="कपड़े"
        label="आप यहाँ हैं"
        linkAs={ShopLink}
        className="extra"
      />,
    );

    const nav = screen.getByRole("navigation", { name: "आप यहाँ हैं" });
    expect(nav.className).toBe("mb-breadcrumbs extra");
    expect(screen.getByRole("link", { name: "होम" }).getAttribute("href")).toBe("/hi/");
  });
});
