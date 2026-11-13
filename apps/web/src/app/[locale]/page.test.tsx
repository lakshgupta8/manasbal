import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MESSAGES, type TestLocale } from "@/test/intl";
import Home from "./page";

vi.mock("next-intl/server", () => import("@/test/intl"));
// The catalogue has its own test; here it shows the language the page passes it.
vi.mock("@/components/home-catalog", () => ({
  HomeCatalog: ({ locale }: { locale: string }) => <p>{`catalogue in ${locale}`}</p>,
}));

async function home(locale: TestLocale) {
  return render(
    await Home({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }),
  );
}

describe("Home", () => {
  it("welcomes the visitor in English, then shows the catalogue", async () => {
    await home("en");

    expect(screen.getByRole("heading", { level: 1, name: "Welcome to Manasbal" })).toBeDefined();
    expect(screen.getByText(/nothing here is for sale/)).toBeDefined();
    expect(screen.getByText("catalogue in en")).toBeDefined();
  });

  it("shows the same page in Hindi", async () => {
    await home("hi");

    const words = MESSAGES.hi.Home;
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeDefined();
    expect(screen.getByText(words.tagline)).toBeDefined();
    expect(screen.getByText("catalogue in hi")).toBeDefined();
  });
});
