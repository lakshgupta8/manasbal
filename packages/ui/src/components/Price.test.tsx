import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatPaise, Price } from "./Price";
import * as stories from "./Price.stories";

const { Small, Large, Hindi, AllLight, AllDark } = composeStories(stories);

describe("formatPaise", () => {
  it.each([
    [12999900, "₹1,29,999.00"],
    [100, "₹1.00"],
    [0, "₹0.00"],
    [4950, "₹49.50"],
    [1, "₹0.01"],
    [1234567800, "₹1,23,45,678.00"],
    [Number.MAX_SAFE_INTEGER, "₹9,00,71,99,25,47,409.91"],
  ])("shows %s paise as %s", (paise, shown) => {
    expect(formatPaise(paise)).toBe(shown);
  });

  it.each([
    [12.5, "12.5"],
    [-100, "-100"],
    [Number.NaN, "NaN"],
    [Number.POSITIVE_INFINITY, "Infinity"],
    [Number.MAX_SAFE_INTEGER + 1, "9007199254740992"],
    ["100", "string"],
    [100n, "bigint"],
    [null, "object"],
    [undefined, "undefined"],
  ])("refuses %s", (paise, got) => {
    expect(() => formatPaise(paise as number)).toThrow(
      new TypeError(`A price is a whole, non-negative number of paise; got ${got}`),
    );
  });
});

describe("Price", () => {
  it("shows the amount and tells screen readers it in words", () => {
    const { container } = render(<Small />);

    const price = container.querySelector("data")!;
    expect(price.value).toBe("12999900");
    expect(price.className).toBe("mb-price mb-price--small");
    expect(screen.getByText("₹1,29,999.00").getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("1,29,999 rupees").className).toBe("mb-price__spoken");
  });

  it("speaks paise only when there are some", () => {
    render(<Price paise={4950} />);

    expect(screen.getByText("49.5 rupees")).toBeDefined();
  });

  it("comes large, with a caller's class", () => {
    const { container } = render(<Large className="extra" />);

    expect(container.querySelector("data")!.className).toBe("mb-price mb-price--large extra");
  });

  it("keeps the same digits on a Hindi page and takes the spoken word from the caller", () => {
    render(<Hindi />);

    expect(screen.getByText("₹1,29,999.00")).toBeDefined();
    expect(screen.getByText("1,29,999 रुपये")).toBeDefined();
  });

  it("refuses a price that is not whole paise", () => {
    expect(() => render(<Price paise={99.5} />)).toThrow(TypeError);
  });

  it.each([AllLight, AllDark])("draws every amount in both sizes", (Sheet) => {
    const { container } = render(<Sheet />);

    expect(container.querySelectorAll("data")).toHaveLength(12);
  });
});
