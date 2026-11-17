import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MESSAGES, withIntl } from "@/test/intl";
import ProductLoading from "./loading";
import ProductNotFound from "./not-found";

describe("ProductLoading", () => {
  it("says the product is loading, politely", () => {
    render(withIntl(<ProductLoading />));

    expect(screen.getByRole("status").textContent).toBe("Loading the product");
  });
});

describe("ProductNotFound", () => {
  it("says the product was not found and links home", () => {
    render(withIntl(<ProductNotFound />));

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Product not found");
    expect(screen.getByText(MESSAGES.en.Product.notFoundBody)).toBeDefined();
    expect(screen.getByRole("link", { name: "Go to the home page" }).getAttribute("href")).toBe(
      "/en",
    );
  });

  it("says so in Hindi on a Hindi page", () => {
    render(withIntl(<ProductNotFound />, "hi"));

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      MESSAGES.hi.Product.notFoundHeading,
    );
    expect(screen.getByRole("link", { name: MESSAGES.hi.Catalog.home }).getAttribute("href")).toBe(
      "/hi",
    );
  });
});
