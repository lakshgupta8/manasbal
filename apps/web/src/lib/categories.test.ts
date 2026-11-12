import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiUnavailableError } from "./api";
import { getCategories } from "./categories";

const TREE = [
  { id: "1a2b3c4d-0000-4000-8000-000000000001", name: "Shoes", slug: "shoes", children: [] },
];

describe("getCategories", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks the API for the categories through the shop's address", async () => {
    const fetchMock = vi.fn<(request: Request) => Promise<Response>>(async () =>
      Response.json(TREE),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCategories()).resolves.toEqual(TREE);
    expect(fetchMock.mock.calls[0]![0].url).toBe(`${window.location.origin}/api/categories`);
  });

  it("throws when the API can't be reached, so the error page shows", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(getCategories()).rejects.toBeInstanceOf(ApiUnavailableError);
  });
});
