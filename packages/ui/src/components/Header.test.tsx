import { composeStories } from "@storybook/react-vite";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Header } from "./Header";
import * as stories from "./Header.stories";

const { Default, LogoOnly } = composeStories(stories);

describe("Header", () => {
  it("is the banner landmark, with the logo linking home", () => {
    render(<Default />);

    const header = screen.getByRole("banner");
    const home = within(header).getByRole("link", { name: "Manasbal" });
    expect(home.getAttribute("href")).toBe("/");
  });

  it("keeps the lotus decorative, since the shop name names the link", () => {
    const { container } = render(<Default />);

    expect(container.querySelector(".mb-header__brand svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("lists the links in order in the main navigation", () => {
    render(<Default />);

    const nav = screen.getByRole("navigation", { name: "Main" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Home", "/"],
      ["Categories", "/categories"],
      ["Stores", "/stores"],
    ]);
  });

  it("shows the language, account and cart slots in that order, after the links", () => {
    render(<Default />);

    const language = screen.getByRole("combobox", { name: "Language" });
    const account = screen.getByRole("link", { name: "Account" });
    const cart = screen.getByRole("link", { name: "Cart" });
    const nav = screen.getByRole("navigation", { name: "Main" });
    const follows = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(nav, language)).toBe(true);
    expect(follows(language, account)).toBe(true);
    expect(follows(account, cart)).toBe(true);
  });

  it("draws no navigation without links, and nothing in empty slots", () => {
    const { container } = render(<LogoOnly />);

    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(container.querySelector(".mb-header__actions")?.childElementCount).toBe(0);
  });

  it("links the logo where the caller says", () => {
    render(<Header links={[]} homeHref="/en" />);

    expect(screen.getByRole("link", { name: "Manasbal" }).getAttribute("href")).toBe("/en");
  });
});
