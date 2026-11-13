import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageState } from "./PageState";
import * as stories from "./PageState.stories";

const { Loading, ErrorState, Empty, NotFound, AllDark } = composeStories(stories);

describe("PageState", () => {
  it("announces loading politely, in words", () => {
    render(<Loading />);

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("Loading products");
    expect(screen.getByRole("heading", { level: 1, name: "Loading products" })).toBeDefined();
  });

  it("says what went wrong, with a way to try again", () => {
    const { container } = render(<ErrorState />);

    expect(screen.queryByRole("status")).toBeNull();
    expect(
      screen.getByRole("heading", { level: 1, name: "This page couldn't load" }),
    ).toBeDefined();
    expect(screen.getByText(/lost touch with its data/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
    expect(container.firstElementChild!.className).toBe("mb-page-state mb-page-state--error");
  });

  it("draws an icon for every kind, hidden from assistive tech", () => {
    const { container } = render(<AllDark />);

    const icons = container.querySelectorAll(".mb-page-state__icon svg");
    expect(icons).toHaveLength(4);
    for (const icon of icons) expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(4);
  });

  it("can sit inside a page under a level-2 heading, with a link onward", () => {
    render(<Empty />);

    expect(screen.getByRole("heading", { level: 2, name: "No products here yet" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Go to the home page" })).toBeDefined();
  });

  it("explains a missing page", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: "Category not found" })).toBeDefined();
  });

  it("leaves out the body and the action when there are none", () => {
    const { container } = render(<PageState kind="empty" title="Nothing" className="extra" />);

    expect(container.querySelector(".mb-page-state__body")).toBeNull();
    expect(container.querySelector(".mb-page-state__action")).toBeNull();
    expect(container.firstElementChild!.className).toBe("mb-page-state mb-page-state--empty extra");
  });
});
