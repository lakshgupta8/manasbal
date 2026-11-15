import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCategoryTree } from "@/lib/categories";
import { getCurrency } from "@/lib/currency";
import { getProduct } from "@/lib/product";
import { MESSAGES } from "@/test/intl";
import ProductPage, { generateMetadata } from "./page";

vi.mock("next-intl/server", () => import("@/test/intl"));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string, type: string) => {
    throw new Error(`NEXT_REDIRECT ${type} ${to}`);
  },
  RedirectType: { replace: "replace", push: "push" },
}));
vi.mock("@/lib/categories", () => ({ getCategoryTree: vi.fn() }));
vi.mock("@/lib/currency", () => ({ getCurrency: vi.fn() }));
vi.mock("@/lib/product", async (original) => ({
  ...(await original<typeof import("@/lib/product")>()),
  getProduct: vi.fn(),
}));

const node = (slug: string, name: string, children: unknown[] = []) => ({
  id: `1a2b3c4d-0000-4000-8000-${slug.length.toString().padStart(12, "0")}`,
  slug,
  name,
  children,
});
const SHIRTS = node("clothing-men-shirts", "Shirts");
const TREE = [node("clothing", "Clothing", [node("clothing-men", "Men", [SHIRTS])])];

const variant = (n: number, size: string, colour: string, available: number) => ({
  variantId: `1a2b3c4d-0000-4000-8000-00000000000${n}`,
  sku: `SKU-00042-${n}`,
  size,
  colour,
  available,
  pricePaise: 129900,
});

const PRODUCT = {
  id: "1a2b3c4d-0000-4000-8000-000000000042",
  slug: "linen-shirt",
  name: "Linen Shirt",
  description: "A light shirt for warm days.",
  pricePaise: 129900,
  category: { slug: SHIRTS.slug, name: SHIRTS.name },
  seller: { slug: "river-stores", storeName: "River Stores" },
  variants: [variant(1, "S", "White", 0), variant(2, "M", "White", 6), variant(3, "M", "Navy", 2)],
};

const args = (search: Record<string, string> = {}, slug = PRODUCT.slug, locale = "en") =>
  ({ params: Promise.resolve({ locale, slug }), searchParams: Promise.resolve(search) }) as never;

describe("ProductPage", () => {
  beforeEach(() => {
    vi.mocked(getCurrency).mockResolvedValue("INR");
    vi.mocked(getCategoryTree).mockResolvedValue(TREE as never);
    vi.mocked(getProduct).mockReset();
    vi.mocked(getProduct).mockResolvedValue(PRODUCT);
  });

  it("titles the page with the product's name and describes it", async () => {
    await expect(generateMetadata(args())).resolves.toEqual({
      title: "Linen Shirt",
      description: "A light shirt for warm days.",
    });
    vi.mocked(getProduct).mockResolvedValue({ ...PRODUCT, description: null });
    await expect(generateMetadata(args())).resolves.toEqual({
      title: "Linen Shirt",
      description: undefined,
    });
  });

  it("shows where it sits, with the category linking back to its page", async () => {
    render(await ProductPage(args()));

    expect(getProduct).toHaveBeenCalledWith("linen-shirt");
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumbs" });
    expect(
      within(crumbs)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Home", "/en"],
      ["Clothing", "/en/c/clothing"],
      ["Men", "/en/c/clothing-men"],
      ["Shirts", "/en/c/clothing-men-shirts"],
    ]);
    expect(within(crumbs).getByText("Linen Shirt").getAttribute("aria-current")).toBe("page");
  });

  it("shows the picture, name, seller, price, pickers, stock and description", async () => {
    render(await ProductPage(args()));

    expect(screen.getByRole("img", { name: "Linen Shirt" })).toBeDefined();
    expect(screen.getByRole("heading", { level: 1, name: "Linen Shirt" })).toBeDefined();
    expect(screen.getByText("Sold by River Stores")).toBeDefined();
    expect(screen.getByText("₹1,299.00")).toBeDefined();
    // The first variant in stock: M·White, as S·White has none.
    expect((screen.getByRole("radio", { name: "M" }) as HTMLInputElement).checked).toBe(true);
    expect(
      (screen.getByRole("radio", { name: "S (not available)" }) as HTMLInputElement).checked,
    ).toBe(false);
    expect(screen.getByRole("status").textContent).toBe("In stock");
    expect(screen.getByRole("heading", { level: 2, name: "About this product" })).toBeDefined();
    expect(screen.getByText("A light shirt for warm days.")).toBeDefined();
    // No rating until the API has one (Week 9), and no Add to cart yet.
    expect(screen.queryByRole("img", { name: /out of 5/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /cart/i })).toBeNull();
  });

  it("chooses the variant the address names, even out of stock", async () => {
    render(await ProductPage(args({ variant: "SKU-00042-1" })));

    expect(
      (screen.getByRole("radio", { name: "S (not available)" }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Out of stock");
  });

  it("falls back to the first variant in stock for a variant that doesn't exist", async () => {
    render(await ProductPage(args({ variant: "SKU-NOPE" })));

    expect((screen.getByRole("radio", { name: "M" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("In stock");
  });

  it("sends the no-JavaScript form's choice on to the ?variant= address", async () => {
    await expect(ProductPage(args({ size: "M", colour: "Navy" }))).rejects.toThrow(
      "NEXT_REDIRECT replace /en/p/linen-shirt?variant=SKU-00042-3",
    );
  });

  it("is not found for a slug the API doesn't know", async () => {
    vi.mocked(getProduct).mockResolvedValue(undefined);

    await expect(ProductPage(args({}, "no-such-thing"))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(generateMetadata(args({}, "no-such-thing"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("lets the error page show when the API can't be reached", async () => {
    vi.mocked(getProduct).mockRejectedValue(new Error("down"));

    await expect(ProductPage(args())).rejects.toThrow("down");
  });

  it("links the category alone when the tree doesn't have it, and skips what's missing", async () => {
    vi.mocked(getCategoryTree).mockResolvedValue([] as never);
    vi.mocked(getProduct).mockResolvedValue({ ...PRODUCT, description: null, variants: [] });
    render(await ProductPage(args()));

    const crumbs = screen.getByRole("navigation", { name: "Breadcrumbs" });
    expect(
      within(crumbs)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Home", "Shirts"]);
    expect(screen.queryByRole("form")).toBeNull();
    expect(screen.getByText("Out of stock")).toBeDefined();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });

  it("speaks Hindi on a Hindi page", async () => {
    render(await ProductPage(args({}, PRODUCT.slug, "hi")));

    const words = MESSAGES.hi.Product;
    expect(screen.getByRole("navigation", { name: words.breadcrumbs })).toBeDefined();
    expect(screen.getByText(`विक्रेता: River Stores`)).toBeDefined();
    expect(screen.getByRole("group", { name: words.size })).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe(words.inStock);
  });
});
