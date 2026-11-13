import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEMO_USD_RATE, formatPaise, formatPaiseInDollars, paiseToCents, Price } from "./Price";
import * as stories from "./Price.stories";

const { Small, Large, Hindi, AllLight, AllDark, Dollars, DollarsSmall, DollarsHindi, DollarsDark } =
  composeStories(stories);

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

describe("dollars, for display only", () => {
  it("uses a fixed demo rate of 88 paise to the cent (₹88 to the dollar)", () => {
    expect(DEMO_USD_RATE).toBe(88);
  });

  it.each([
    [0, 0n],
    [1, 0n],
    [43, 0n],
    [44, 1n],
    [45, 1n],
    [88, 1n],
    [132, 2n],
    [137280, 1560n],
    [12999900, 147726n],
    [Number.MAX_SAFE_INTEGER, 102354536985693n],
  ])("turns %s paise into %s cents, rounding half up in whole numbers", (paise, cents) => {
    expect(paiseToCents(paise)).toBe(cents);
  });

  it.each([
    [0, "≈ $0.00"],
    [1, "≈ $0.00"],
    [44, "≈ $0.01"],
    [137280, "≈ $15.60"],
    [12999900, "≈ $1,477.26"],
    [Number.MAX_SAFE_INTEGER, "≈ $1,023,545,369,856.93"],
  ])("shows %s paise as %s", (paise, shown) => {
    expect(formatPaiseInDollars(paise)).toBe(shown);
  });

  it.each([12.5, -1, Number.NaN, Number.MAX_SAFE_INTEGER + 1])("refuses %s paise", (paise) => {
    expect(() => paiseToCents(paise)).toThrow(TypeError);
    expect(() => formatPaiseInDollars(paise)).toThrow(TypeError);
  });

  it("shows ≈ dollars and tells screen readers it is about that many", () => {
    const { container } = render(<Dollars />);

    expect(container.querySelector("data")!.value).toBe("12999900");
    expect(screen.getByText("≈ $1,477.26").getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("about 1,477 dollars 26 cents").className).toBe("mb-price__spoken");
  });

  it("leaves out the cents when there are none", () => {
    render(<Price paise={137280 - 60 * 88} currency="USD" />);

    expect(screen.getByText("≈ $15.00")).toBeDefined();
    expect(screen.getByText("about 15 dollars")).toBeDefined();
  });

  it("keeps Latin digits on a Hindi page, with the page's words", () => {
    render(<DollarsHindi />);

    expect(screen.getByText("≈ $1,477.26")).toBeDefined();
    expect(screen.getByText("लगभग 1,477 डॉलर 26 सेंट")).toBeDefined();
  });

  it.each([DollarsSmall, DollarsDark])("draws in both sizes and themes (%#)", (Story) => {
    render(<Story />);

    expect(screen.getByText("≈ $1,477.26")).toBeDefined();
  });

  it("still refuses a price that is not whole paise", () => {
    expect(() => render(<Price paise={0.5} currency="USD" />)).toThrow(TypeError);
  });
});
