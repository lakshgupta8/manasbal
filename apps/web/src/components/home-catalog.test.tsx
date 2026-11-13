import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProducts } from "@/lib/catalog";
import { getCategoryTree } from "@/lib/categories";
import { MESSAGES } from "@/test/intl";
import { HomeCatalog } from "./home-catalog";

vi.mock("next-intl/server", () => import("@/test/intl"));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/categories", () => ({ getCategoryTree: vi.fn() }));
vi.mock("@/lib/catalog", async (original) => ({
  ...(await original<typeof import("@/lib/catalog")>()),
  getProducts: vi.fn(),
}));

const CLOTHING = {
  id: "1a2b3c4d-0000-4000-8000-000000000001",
  name: "Clothing",
  slug: "clothing",
  children: [],
};
const TEE = {
  id: "1a2b3c4d-0000-4000-8000-0000000000a1",
  slug: "striped-tee",
  name: "Striped tee",
  pricePaise: 49900,
  category: { slug: "clothing-men-t-shirts", name: "T-shirts" },
};

describe("HomeCatalog", () => {
  beforeEach(() => {
    vi.mocked(getCategoryTree).mockResolvedValue([CLOTHING]);
    vi.mocked(getProducts).mockResolvedValue({ items: [TEE], nextCursor: "next" });
  });

  it("shows the categories as tiles and the first 8 products as cards", async () => {
    render(await HomeCatalog({ locale: "en" }));

    expect(getProducts).toHaveBeenCalledWith({ limit: 8 });
    const categories = screen.getByRole("region", { name: "Shop by category" });
    expect(within(categories).getByRole("link", { name: "Clothing" }).getAttribute("href")).toBe(
      "/en/c/clothing",
    );
    const products = screen.getByRole("region", { name: "A few products to start with" });
    const card = within(products).getByRole("article");
    expect(within(card).getByRole("heading", { level: 3, name: "Striped tee" })).toBeDefined();
    expect(within(card).getByText("Sample")).toBeDefined();
    expect(within(card).getByText("₹499.00")).toBeDefined();
    // The home page shows one page only: no paging.
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("speaks Hindi on a Hindi page, keeping Latin digits", async () => {
    render(await HomeCatalog({ locale: "hi" }));

    const words = MESSAGES.hi;
    expect(screen.getByRole("region", { name: words.Home.categoriesHeading })).toBeDefined();
    expect(screen.getByText(words.Catalog.sample)).toBeDefined();
    expect(screen.getByText("₹499.00")).toBeDefined();
    expect(screen.getByText(`499 ${words.Catalog.rupees}`)).toBeDefined();
    expect(screen.getByRole("link", { name: "Striped tee" }).getAttribute("href")).toBe(
      "/hi/p/striped-tee",
    );
  });

  it("says so when there are no categories or products yet", async () => {
    vi.mocked(getCategoryTree).mockResolvedValue([]);
    vi.mocked(getProducts).mockResolvedValue({ items: [], nextCursor: null });

    render(await HomeCatalog({ locale: "en" }));

    expect(screen.getByRole("status").textContent).toBe("Note: There are no categories yet");
    expect(screen.getByText("No products here yet")).toBeDefined();
  });

  it("lets a stopped API through to the page's error boundary", async () => {
    vi.mocked(getProducts).mockRejectedValue(new Error("down"));

    await expect(HomeCatalog({ locale: "en" })).rejects.toThrow("down");
  });
});
