import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError } from "@/lib/api";
import { getProducts } from "@/lib/catalog";
import { getCategoryTree } from "@/lib/categories";
import { MESSAGES } from "@/test/intl";
import CategoryPage, { generateMetadata } from "./page";

vi.mock("next-intl/server", () => import("@/test/intl"));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/categories", () => ({ getCategoryTree: vi.fn() }));
vi.mock("@/lib/catalog", async (original) => ({
  ...(await original<typeof import("@/lib/catalog")>()),
  getProducts: vi.fn(),
}));

const node = (slug: string, name: string, children: unknown[] = []) => ({
  id: `1a2b3c4d-0000-4000-8000-${slug.length.toString().padStart(12, "0")}`,
  slug,
  name,
  children,
});
const SHIRTS = node("clothing-men-shirts", "Shirts");
const MEN = node("clothing-men", "Men", [SHIRTS]);
const CLOTHING = node("clothing", "Clothing", [MEN]);
const TREE = [CLOTHING, node("toys", "Toys")];

const product = (n: number) => ({
  id: `1a2b3c4d-0000-4000-8000-0000000000a${n}`,
  slug: `shirt-${n}`,
  name: `Shirt ${n}`,
  pricePaise: 99900 + n,
  category: { slug: SHIRTS.slug, name: SHIRTS.name },
});

const args = (slug: string, search: Record<string, string> = {}, locale = "en") =>
  ({ params: Promise.resolve({ locale, slug }), searchParams: Promise.resolve(search) }) as never;

describe("CategoryPage", () => {
  beforeEach(() => {
    vi.mocked(getCategoryTree).mockResolvedValue(TREE as never);
    vi.mocked(getProducts).mockReset();
    vi.mocked(getProducts).mockResolvedValue({
      items: [product(1), product(2)],
      nextCursor: "c2",
    });
  });

  it("titles the page with the category's name", async () => {
    await expect(generateMetadata(args(SHIRTS.slug))).resolves.toEqual({ title: "Shirts" });
  });

  it("shows where it sits, its name and its first page of products, 12 to a page", async () => {
    render(await CategoryPage(args(SHIRTS.slug)));

    expect(getProducts).toHaveBeenCalledWith({
      category: SHIRTS.slug,
      cursor: undefined,
      limit: 12,
    });
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumbs" });
    expect(
      within(crumbs)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Home", "/en"],
      ["Clothing", "/en/c/clothing"],
      ["Men", "/en/c/clothing-men"],
    ]);
    expect(within(crumbs).getByText("Shirts").getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("heading", { level: 1, name: "Shirts" })).toBeDefined();
    const cards = screen.getAllByRole("article");
    expect(
      cards.map((card) => within(card).getByRole("heading", { level: 2 }).textContent),
    ).toEqual(["Shirt 1", "Shirt 2"]);
    expect(within(cards[0]!).getByText("Sample")).toBeDefined();
  });

  it("links to the next page on page 1, with previous off", async () => {
    render(await CategoryPage(args(SHIRTS.slug)));

    const pages = screen.getByRole("navigation", { name: "Pages" });
    expect(within(pages).getByText("Page 1")).toBeDefined();
    expect(within(pages).queryByRole("link", { name: "Previous page" })).toBeNull();
    expect(within(pages).getByRole("link", { name: "Next page" }).getAttribute("href")).toBe(
      `/en/c/${SHIRTS.slug}?cursor=c2`,
    );
  });

  it("goes back from the last page, with next off", async () => {
    vi.mocked(getProducts).mockResolvedValue({ items: [product(5)], nextCursor: null });

    render(await CategoryPage(args(SHIRTS.slug, { cursor: "c3", from: "c2" })));

    expect(getProducts).toHaveBeenCalledWith({ category: SHIRTS.slug, cursor: "c3", limit: 12 });
    const pages = screen.getByRole("navigation", { name: "Pages" });
    expect(within(pages).getByText("Page 3")).toBeDefined();
    expect(within(pages).getByRole("link", { name: "Previous page" }).getAttribute("href")).toBe(
      `/en/c/${SHIRTS.slug}?cursor=c2`,
    );
    expect(within(pages).queryByRole("link", { name: "Next page" })).toBeNull();
  });

  it("leaves the paging out when everything fits on one page", async () => {
    vi.mocked(getProducts).mockResolvedValue({ items: [product(1)], nextCursor: null });

    render(await CategoryPage(args(SHIRTS.slug)));

    expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();
  });

  it("shows a parent category's subcategories as tiles, without an empty state", async () => {
    vi.mocked(getProducts).mockResolvedValue({ items: [], nextCursor: null });

    render(await CategoryPage(args(CLOTHING.slug)));

    const section = screen.getByRole("region", { name: "Browse Clothing" });
    expect(within(section).getByRole("link", { name: "Men" }).getAttribute("href")).toBe(
      "/en/c/clothing-men",
    );
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByText("No products here yet")).toBeNull();
  });

  it("says so, with a way home, when a category has nothing in it", async () => {
    vi.mocked(getProducts).mockResolvedValue({ items: [], nextCursor: null });

    render(await CategoryPage(args("toys")));

    expect(screen.getByRole("heading", { level: 2, name: "No products here yet" })).toBeDefined();
    expect(screen.getByText(MESSAGES.en.Category.emptyBody)).toBeDefined();
    expect(screen.getByRole("link", { name: "Go to the home page" }).getAttribute("href")).toBe(
      "/en",
    );
  });

  it("is not found for a slug that isn't a category, without asking for products", async () => {
    await expect(CategoryPage(args("hats"))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(generateMetadata(args("hats"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getProducts).not.toHaveBeenCalled();
  });

  it("is not found for a cursor the API can't read", async () => {
    vi.mocked(getProducts).mockRejectedValue(new ApiResponseError(400, "cursor is not valid"));

    await expect(CategoryPage(args(SHIRTS.slug, { cursor: "bad" }))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("lets a stopped API through to the error page", async () => {
    vi.mocked(getProducts).mockRejectedValue(new Error("down"));

    await expect(CategoryPage(args(SHIRTS.slug))).rejects.toThrow("down");
  });

  it("speaks Hindi on a Hindi page", async () => {
    render(await CategoryPage(args(SHIRTS.slug, {}, "hi")));

    const words = MESSAGES.hi.Category;
    const crumbs = screen.getByRole("navigation", { name: words.breadcrumbs });
    expect(within(crumbs).getByRole("link", { name: words.home }).getAttribute("href")).toBe("/hi");
    const pages = screen.getByRole("navigation", { name: words.pages });
    expect(within(pages).getByText("पेज 1")).toBeDefined();
    expect(within(pages).getByRole("link", { name: words.next })).toBeDefined();
  });
});
