import type { CategoryTree, ProductPage } from "@manasbal/sdk";
import { apiCall, ApiResponseError } from "./api";

// The home page shows the first 8 products (two rows on a desktop), with no paging.
export const HOME_PAGE_SIZE = 8;
// A category page shows 12 products at a time: 3 full rows of 4 on a desktop. The demo data has
// 24 to 32 products in each category, so every demo category has 2 or 3 pages. One line to change.
export const CATEGORY_PAGE_SIZE = 12;

export type Category = CategoryTree[number];

// One page of products, optionally in one category. An unknown category answers an empty page.
// When the API can't be reached or answers with an error, this throws (see apiCall).
export function getProducts(query: {
  readonly category?: string;
  readonly cursor?: string;
  readonly limit: number;
}): Promise<ProductPage> {
  const { category, cursor, limit } = query;
  return apiCall((api) =>
    api.GET("/products", { params: { query: { category, cursor, limit: String(limit) } } }),
  );
}

// True for the API's answer to a cursor it can't read: someone edited the address.
export function isBadCursor(error: unknown): boolean {
  return error instanceof ApiResponseError && error.status === 400;
}

export interface FoundCategory {
  readonly category: Category;
  // The categories above it, from the top.
  readonly ancestors: readonly Category[];
}

// Finds a category by its slug anywhere in the tree, with the categories above it. The API has
// no lookup by slug, and its product list answers an unknown slug with an empty page, so this is
// how the shop knows a category does not exist.
export function findCategory(
  tree: readonly Category[],
  slug: string,
  ancestors: readonly Category[] = [],
): FoundCategory | undefined {
  for (const category of tree) {
    if (category.slug === slug) return { category, ancestors };
    const found = findCategory(category.children, slug, [...ancestors, category]);
    if (found) return found;
  }
  return undefined;
}

// Where the visitor is in a category's pages. The API pages forward only (nextCursor), so the
// address keeps the cursors of the pages before this one: ?cursor=<this page>&from=<page 2>,<page
// 3>... Page 1 has neither. That needs no client code, and survives a reload or a shared link.
export interface PageTrail {
  readonly cursor?: string;
  readonly from: readonly string[];
}

// Reads the trail from the address. The API checks each cursor; a bad one answers 400.
export function readTrail(search: {
  readonly cursor?: string | string[];
  readonly from?: string | string[];
}): PageTrail {
  const cursor = typeof search.cursor === "string" && search.cursor !== "" ? search.cursor : "";
  const from =
    cursor !== "" && typeof search.from === "string"
      ? search.from.split(",").filter((part) => part !== "")
      : [];
  return cursor === "" ? { from: [] } : { cursor, from };
}

// 1 on the first page, then one more for each page before this one.
export function pageNumber(trail: PageTrail): number {
  return trail.cursor === undefined ? 1 : trail.from.length + 2;
}

function address(base: string, cursor: string | undefined, from: readonly string[]): string {
  if (cursor === undefined) return base;
  const query = new URLSearchParams({ cursor });
  if (from.length > 0) query.set("from", from.join(","));
  return `${base}?${query.toString()}`;
}

// The previous page's address, or undefined on page 1.
export function previousPage(base: string, trail: PageTrail): string | undefined {
  if (trail.cursor === undefined) return undefined;
  return address(base, trail.from.at(-1), trail.from.slice(0, -1));
}

// The next page's address, or undefined on the last page.
export function nextPage(
  base: string,
  trail: PageTrail,
  nextCursor: string | null,
): string | undefined {
  if (nextCursor === null) return undefined;
  const from = trail.cursor === undefined ? [] : [...trail.from, trail.cursor];
  return address(base, nextCursor, from);
}
