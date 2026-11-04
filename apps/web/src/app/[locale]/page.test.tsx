import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MESSAGES, type TestLocale } from "@/test/intl";
import Home from "./page";

vi.mock("next-intl/server", () => import("@/test/intl"));
// The list has its own test; here it shows the words the page passes it.
vi.mock("@/components/categories", () => ({
  Categories: ({ emptyText, noteLead }: { emptyText: string; noteLead: string }) => (
    <p>{`${noteLead} ${emptyText}`}</p>
  ),
}));

async function home(locale: TestLocale) {
  return render(
    await Home({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }),
  );
}

describe("Home", () => {
  it("shows the shop name and the categories section in English", async () => {
    await home("en");

    expect(screen.getByRole("heading", { level: 1, name: "Manasbal" })).toBeDefined();
    expect(screen.getByText("A demo multi-vendor marketplace, under construction.")).toBeDefined();
    expect(screen.getByRole("region", { name: "Categories" })).toBeDefined();
    expect(screen.getByText("Note: There are no categories yet")).toBeDefined();
  });

  it("shows the same page in Hindi, keeping the shop's name", async () => {
    await home("hi");

    const words = MESSAGES.hi.Home;
    expect(screen.getByRole("heading", { level: 1, name: "Manasbal" })).toBeDefined();
    expect(screen.getByText(words.tagline)).toBeDefined();
    expect(screen.getByRole("region", { name: words.categoriesHeading })).toBeDefined();
    expect(screen.getByText(`${words.noteLead} ${words.noCategories}`)).toBeDefined();
  });
});
