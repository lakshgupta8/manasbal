import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError, ApiUnavailableError } from "./api";
import {
  CATEGORY_PAGE_SIZE,
  findCategory,
  getProducts,
  HOME_PAGE_SIZE,
  isBadCursor,
  nextPage,
  pageNumber,
  previousPage,
  readTrail,
  type Category,
} from "./catalog";

const node = (slug: string, children: Category[] = []): Category => ({
  id: `1a2b3c4d-0000-4000-8000-${slug.length.toString().padStart(12, "0")}`,
  name: slug.toUpperCase(),
  slug,
  children,
});
const SHIRTS = node("shirts");
const MEN = node("men", [SHIRTS]);
const CLOTHING = node("clothing", [MEN, node("women")]);
const TREE = [node("books"), CLOTHING];

describe("page sizes", () => {
  it("shows 8 products on the home page and 12 on a category page", () => {
    expect(HOME_PAGE_SIZE).toBe(8);
    expect(CATEGORY_PAGE_SIZE).toBe(12);
  });
});

describe("getProducts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks the API for one page, in a category, after a cursor", async () => {
    const page = { items: [], nextCursor: null };
    const fetchMock = vi.fn<(request: Request) => Promise<Response>>(async () =>
      Response.json(page),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getProducts({ category: "shirts", cursor: "abc", limit: 4 })).resolves.toEqual(
      page,
    );
    const url = new URL(fetchMock.mock.calls[0]![0].url);
    expect(url.pathname).toBe("/api/products");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      category: "shirts",
      cursor: "abc",
      limit: "4",
    });
  });

  it("leaves out what isn't given", async () => {
    const fetchMock = vi.fn<(request: Request) => Promise<Response>>(async () =>
      Response.json({ items: [], nextCursor: null }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getProducts({ limit: 8 });

    expect(new URL(fetchMock.mock.calls[0]![0].url).search).toBe("?limit=8");
  });

  it("throws when the API can't be reached, so the error page shows", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(getProducts({ limit: 8 })).rejects.toBeInstanceOf(ApiUnavailableError);
  });
});

describe("isBadCursor", () => {
  it("is true only for the API's 400", () => {
    expect(isBadCursor(new ApiResponseError(400, "cursor is not valid"))).toBe(true);
    expect(isBadCursor(new ApiResponseError(500, "Internal Server Error"))).toBe(false);
    expect(isBadCursor(new ApiUnavailableError("down"))).toBe(false);
  });
});

describe("findCategory", () => {
  it("finds a category at any depth, with the ones above it", () => {
    expect(findCategory(TREE, "shirts")).toEqual({ category: SHIRTS, ancestors: [CLOTHING, MEN] });
    expect(findCategory(TREE, "clothing")).toEqual({ category: CLOTHING, ancestors: [] });
  });

  it("finds nothing for a slug that isn't in the tree", () => {
    expect(findCategory(TREE, "hats")).toBeUndefined();
    expect(findCategory([], "shirts")).toBeUndefined();
  });
});

describe("the page trail", () => {
  const base = "/en/c/shirts";

  it("reads page 1 from an address without a cursor", () => {
    const trail = readTrail({});
    expect(trail).toEqual({ from: [] });
    expect(pageNumber(trail)).toBe(1);
    expect(previousPage(base, trail)).toBeUndefined();
    expect(nextPage(base, trail, "c2")).toBe(`${base}?cursor=c2`);
  });

  it("ignores an empty or repeated cursor, and a trail without a cursor", () => {
    expect(readTrail({ cursor: "" })).toEqual({ from: [] });
    expect(readTrail({ cursor: ["a", "b"] })).toEqual({ from: [] });
    expect(readTrail({ from: "c2" })).toEqual({ from: [] });
    expect(readTrail({ cursor: "c3", from: ["c2", "x"] })).toEqual({ cursor: "c3", from: [] });
  });

  it("goes from page 2 back to page 1 and on to page 3", () => {
    const trail = readTrail({ cursor: "c2" });
    expect(pageNumber(trail)).toBe(2);
    expect(previousPage(base, trail)).toBe(base);
    expect(nextPage(base, trail, "c3")).toBe(`${base}?cursor=c3&from=c2`);
  });

  it("goes from page 4 back to page 3, dropping empty parts of the trail", () => {
    const trail = readTrail({ cursor: "c4", from: "c2,,c3," });
    expect(trail).toEqual({ cursor: "c4", from: ["c2", "c3"] });
    expect(pageNumber(trail)).toBe(4);
    expect(previousPage(base, trail)).toBe(`${base}?cursor=c3&from=c2`);
    expect(nextPage(base, trail, "c5")).toBe(`${base}?cursor=c5&from=c2%2Cc3%2Cc4`);
  });

  it("has no next page on the last one", () => {
    expect(nextPage(base, readTrail({ cursor: "c2" }), null)).toBeUndefined();
  });
});
