import { composeStories } from "@storybook/react-vite";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CurrencySwitch } from "./CurrencySwitch";
import * as stories from "./CurrencySwitch.stories";

const { Rupees, Dollars, Hindi, Dark, DollarsDark } = composeStories(stories);

describe("CurrencySwitch", () => {
  it("is a named group of two buttons, with rupees pressed", () => {
    render(<Rupees />);

    const group = screen.getByRole("group", { name: "Prices in" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["₹ INR", "$ USD"]);
    expect(screen.getByRole("button", { name: "₹ INR", pressed: true })).toBeDefined();
    expect(screen.getByRole("button", { name: "$ USD", pressed: false })).toBeDefined();
  });

  it("marks the pressed one with a tick too, not colour alone", () => {
    render(<Dollars />);

    const pressed = screen.getByRole("button", { pressed: true });
    expect(pressed.textContent).toBe("$ USD");
    expect(pressed.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("button", { pressed: false }).querySelector("svg")).toBeNull();
  });

  it("is a real form whose submit buttons send currency=INR or USD", () => {
    const { container } = render(<Rupees />);

    const form = container.querySelector("form")!;
    expect(form.getAttribute("action")).toBe("#");
    for (const button of within(form).getAllByRole("button")) {
      expect(button.getAttribute("type")).toBe("submit");
      expect(button.getAttribute("name")).toBe("currency");
    }
    expect(
      within(form)
        .getAllByRole("button")
        .map((b) => b.getAttribute("value")),
    ).toEqual(["INR", "USD"]);
  });

  it("takes the page's words", () => {
    render(<Hindi />);

    expect(screen.getByRole("group", { name: "कीमतें" })).toBeDefined();
    expect(screen.getByRole("button", { name: "₹ रुपये", pressed: true })).toBeDefined();
  });

  it.each([Dark, DollarsDark])("draws in the dark (%#)", (Story) => {
    render(<Story />);

    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("adds a caller's class", () => {
    const { container } = render(<CurrencySwitch current="INR" action="#" className="extra" />);

    expect(container.querySelector("form")!.className).toBe("mb-currency-switch extra");
  });
});
