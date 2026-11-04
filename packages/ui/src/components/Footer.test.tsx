import { composeStories } from "@storybook/react-vite";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as stories from "./Footer.stories";

const { Default, SmallPrintOnly } = composeStories(stories);

describe("Footer", () => {
  it("is the content-info landmark", () => {
    render(<Default />);

    expect(screen.getByRole("contentinfo")).toBeDefined();
  });

  it("lists the links in order in the footer navigation", () => {
    render(<Default />);

    const nav = screen.getByRole("navigation", { name: "Footer" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["About this demo", "/about"],
      ["Privacy", "/privacy"],
      ["Source code", "/source"],
    ]);
  });

  it("ends with the line of small print", () => {
    render(<Default />);

    const footer = screen.getByRole("contentinfo");
    expect(footer.lastElementChild?.textContent).toBe(
      "A portfolio demo. Nothing here is for sale.",
    );
  });

  it("draws no navigation without links", () => {
    render(<SmallPrintOnly />);

    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getByRole("contentinfo").textContent).toContain("Nothing here is for sale");
  });
});
