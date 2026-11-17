import { afterEach, describe, expect, it, vi } from "vitest";
import { apiCall, ApiResponseError, ApiUnavailableError } from "./api";
import { getProduct } from "./product";

vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  apiCall: vi.fn(),
}));

afterEach(() => {
  vi.mocked(apiCall).mockReset();
});

describe("getProduct", () => {
  it("asks the API for the product by its slug", async () => {
    const product = { slug: "a-shirt" };
    let asked: unknown;
    vi.mocked(apiCall).mockImplementation(async (call) => {
      const api = {
        GET: (path: string, options: unknown) => {
          asked = [path, options];
          return Promise.resolve({ data: product, response: new Response() });
        },
      };
      return (await call(api as never)).data;
    });

    await expect(getProduct("a-shirt")).resolves.toBe(product);
    expect(asked).toEqual(["/products/{slug}", { params: { path: { slug: "a-shirt" } } }]);
  });

  it("answers undefined for a slug the API doesn't know", async () => {
    vi.mocked(apiCall).mockRejectedValue(new ApiResponseError(404, "Not Found"));

    await expect(getProduct("no-such-thing")).resolves.toBeUndefined();
  });

  it("throws any other error, so the error page shows", async () => {
    vi.mocked(apiCall).mockRejectedValue(new ApiUnavailableError("down"));
    await expect(getProduct("down-1")).rejects.toBeInstanceOf(ApiUnavailableError);

    vi.mocked(apiCall).mockRejectedValue(new ApiResponseError(500, "Oops"));
    await expect(getProduct("down-2")).rejects.toBeInstanceOf(ApiResponseError);
  });
});
