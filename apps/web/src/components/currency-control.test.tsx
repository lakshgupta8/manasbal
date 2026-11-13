import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrency } from "@/lib/currency";
import { MESSAGES } from "@/test/intl";
import { CurrencyControl } from "./currency-control";

vi.mock("next-intl/server", () => import("@/test/intl"));
vi.mock("@/lib/currency", () => ({ getCurrency: vi.fn() }));
vi.mock("@/lib/currency-action", () => ({ setCurrency: "/set-currency" }));

describe("CurrencyControl", () => {
  beforeEach(() => {
    vi.mocked(getCurrency).mockResolvedValue("INR");
  });

  it("shows the switch with the visitor's current choice pressed", async () => {
    vi.mocked(getCurrency).mockResolvedValue("USD");

    const { container } = render(await CurrencyControl({ locale: "en" }));

    expect(screen.getByRole("group", { name: "Prices in" })).toBeDefined();
    expect(screen.getByRole("button", { name: "$ USD", pressed: true })).toBeDefined();
    expect(screen.getByRole("button", { name: "₹ INR", pressed: false })).toBeDefined();
    expect(container.querySelector("form")!.getAttribute("action")).toBe("/set-currency");
  });

  it("speaks Hindi on a Hindi page", async () => {
    render(await CurrencyControl({ locale: "hi" }));

    const words = MESSAGES.hi.Frame;
    expect(screen.getByRole("group", { name: words.currencyLabel })).toBeDefined();
    expect(screen.getByRole("button", { name: words.currencyInr, pressed: true })).toBeDefined();
  });
});
