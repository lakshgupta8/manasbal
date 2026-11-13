import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MESSAGES, withIntl } from "@/test/intl";
import CategoryLoading from "./loading";
import CategoryNotFound from "./not-found";

describe("CategoryLoading", () => {
  it("says the products are loading, politely", () => {
    render(withIntl(<CategoryLoading />));

    expect(screen.getByRole("status").textContent).toBe("Loading products");
  });
});

describe("CategoryNotFound", () => {
  it("says the category was not found and links home", () => {
    render(withIntl(<CategoryNotFound />));

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Category not found");
    expect(screen.getByText(MESSAGES.en.Category.notFoundBody)).toBeDefined();
    expect(screen.getByRole("link", { name: "Go to the home page" }).getAttribute("href")).toBe(
      "/en",
    );
  });

  it("says so in Hindi on a Hindi page", () => {
    render(withIntl(<CategoryNotFound />, "hi"));

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      MESSAGES.hi.Category.notFoundHeading,
    );
    expect(screen.getByRole("link", { name: MESSAGES.hi.Catalog.home }).getAttribute("href")).toBe(
      "/hi",
    );
  });
});
