import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Rating } from "./Rating";
import * as stories from "./Rating.stories";

const { Default, NoReviewCount, OneReview, AllValuesLight, AllValuesDark } =
  composeStories(stories);

const stars = (container: HTMLElement) => {
  const img = container.querySelector(".mb-rating__stars")!;
  return [...img.children].map((star) =>
    star.classList.contains("mb-rating__half")
      ? "half"
      : star.classList.contains("mb-rating__full")
        ? "full"
        : "empty",
  );
};

describe("Rating", () => {
  it("gives the value in words and shows the review count as text", () => {
    render(<Default />);

    expect(screen.getByRole("img", { name: "Rated 3.5 out of 5" })).toBeDefined();
    expect(screen.getByText("(120 reviews)").className).toBe("mb-rating__reviews");
  });

  it("hides every star graphic from assistive tech", () => {
    const { container } = render(<Default />);

    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(6);
    for (const svg of svgs) expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it.each([
    [0, ["empty", "empty", "empty", "empty", "empty"]],
    [0.5, ["half", "empty", "empty", "empty", "empty"]],
    [3.5, ["full", "full", "full", "half", "empty"]],
    [4, ["full", "full", "full", "full", "empty"]],
    [5, ["full", "full", "full", "full", "full"]],
  ])("draws %s as full, half and empty stars", (value, expected) => {
    const { container } = render(<Rating value={value} />);

    expect(stars(container)).toEqual(expected);
  });

  it("draws a half star as the half outline under a full star", () => {
    const { container } = render(<Rating value={0.5} />);

    const half = container.querySelector(".mb-rating__half")!;
    expect([...half.children].map((svg) => svg.getAttribute("class"))).toEqual([
      "mb-rating__empty",
      "mb-rating__full",
    ]);
  });

  it("leaves the review count out when there is none", () => {
    const { container } = render(<NoReviewCount />);

    expect(container.querySelector(".mb-rating__reviews")).toBeNull();
  });

  it("takes the words from the caller", () => {
    render(<OneReview label="5 out of 5 stars" className="extra" />);

    expect(screen.getByRole("img", { name: "5 out of 5 stars" })).toBeDefined();
    expect(screen.getByText("(1 review)")).toBeDefined();
    expect(screen.getByRole("img").parentElement!.className).toBe("mb-rating extra");
  });

  it.each([-0.5, 5.5, 4.3, 0.25, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuses %s with a RangeError",
    (value) => {
      expect(() => render(<Rating value={value} />)).toThrow(
        new RangeError(`A rating is 0 to 5 in steps of 0.5; got ${value}`),
      );
    },
  );

  it.each([AllValuesLight, AllValuesDark])("draws every half step", (Sheet) => {
    render(<Sheet />);

    expect(screen.getAllByRole("img")).toHaveLength(11);
  });
});
