import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCategories } from "./categories";

const TREE = [
  { id: "1a2b3c4d-0000-4000-8000-000000000001", name: "Shoes", slug: "shoes", children: [] },
];

function answer(body: unknown, status = 200) {
  return vi.fn<(request: Request) => Promise<Response>>(async () =>
    Response.json(body, { status }),
  );
}

describe("getCategories", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("answers the categories the API sends", async () => {
    const fetchMock = answer(TREE);
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCategories()).resolves.toEqual(TREE);
    const request = fetchMock.mock.calls[0]![0];
    expect(request.url).toBe("http://api.test/categories");
  });

  it("answers null for an error answer", async () => {
    vi.stubGlobal("fetch", answer({ title: "Boom" }, 500));

    await expect(getCategories()).resolves.toBeNull();
  });

  it("answers null, and logs, when the API can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(getCategories()).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith("GET /categories failed", expect.any(TypeError));
  });

  it("answers null without calling the API when API_URL is not set", async () => {
    vi.stubEnv("API_URL", "");
    const fetchMock = answer(TREE);
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCategories()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
