import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as stories from "./LotusMark.stories";

const { Decorative, Labelled, Sizes } = composeStories(stories);

describe("LotusMark", () => {
  it("is hidden from assistive tech when it has no title", () => {
    const { container } = render(<Decorative />);

    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("is an image named by its title", () => {
    render(<Labelled />);

    expect(screen.getByRole("img", { name: "Manasbal" })).toBeTruthy();
  });

  it("renders at the requested size", () => {
    const { container } = render(<Sizes />);
    const widths = [...container.querySelectorAll("svg")].map((svg) => svg.getAttribute("width"));

    expect(widths).toEqual(["16", "24", "32", "64"]);
  });
});
