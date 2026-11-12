import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_TIMEOUT_MS, ApiResponseError, ApiUnavailableError, apiCall, apiClient } from "./api";

const TREE = [
  { id: "1a2b3c4d-0000-4000-8000-000000000001", name: "Shoes", slug: "shoes", children: [] },
];

function answer(body: unknown, init: ResponseInit = {}) {
  return vi.fn<(request: Request, init?: RequestInit) => Promise<Response>>(async () =>
    Response.json(body, init),
  );
}

describe("apiClient", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "http://api.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("calls API_URL directly on the server, with a timeout", async () => {
    const fetchMock = answer(TREE);
    vi.stubGlobal("fetch", fetchMock);
    const timeout = vi.spyOn(AbortSignal, "timeout");

    await apiClient(undefined, false).GET("/categories");

    const [request, init] = fetchMock.mock.calls[0]!;
    expect(request.url).toBe("http://api.test/categories");
    expect(timeout).toHaveBeenCalledWith(API_TIMEOUT_MS);
    expect(init?.signal).toBe(timeout.mock.results[0]!.value);
  });

  it("refuses to run on the server without API_URL", () => {
    vi.stubEnv("API_URL", "");

    expect(() => apiClient(undefined, false)).toThrow(
      new ApiUnavailableError("API_URL is not set"),
    );
  });

  it("calls the shop's own address in the browser: other paths under /api", async () => {
    const fetchMock = answer(TREE);
    vi.stubGlobal("fetch", fetchMock);

    await apiClient().GET("/categories");

    const [request] = fetchMock.mock.calls[0]!;
    expect(request.url).toBe(`${window.location.origin}/api/categories`);
  });

  it("keeps /auth paths, where the refresh cookie lives, and sends the body along", async () => {
    const fetchMock = answer({ accessToken: "a" });
    vi.stubGlobal("fetch", fetchMock);
    const body = { email: "buyer@example.test", password: "a-long-password" };

    await apiClient().POST("/auth/sign-in", { body });

    const [request] = fetchMock.mock.calls[0]!;
    expect(request.url).toBe(`${window.location.origin}/auth/sign-in`);
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual(body);
  });

  it("sends an access token passed in, as a bearer token", async () => {
    const fetchMock = answer({});
    vi.stubGlobal("fetch", fetchMock);

    await apiClient("token-from-memory").GET("/me");

    expect(fetchMock.mock.calls[0]![0].headers.get("authorization")).toBe(
      "Bearer token-from-memory",
    );
  });

  it("never keeps the token in the browser's storage", async () => {
    vi.stubGlobal("fetch", answer({}));
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    await apiClient("token-from-memory").GET("/me");

    expect(setItem).not.toHaveBeenCalled();
  });
});

describe("apiCall", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "http://api.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("answers the data of a successful call", async () => {
    vi.stubGlobal("fetch", answer(TREE));

    await expect(apiCall((api) => api.GET("/categories"))).resolves.toEqual(TREE);
  });

  it("throws ApiResponseError with the problem's title for an error answer", async () => {
    vi.stubGlobal("fetch", answer({ title: "Not found", status: 404 }, { status: 404 }));

    const error = await apiCall((api) => api.GET("/categories")).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiResponseError);
    expect(error).toMatchObject({ status: 404, title: "Not found" });
    expect((error as Error).message).toBe("The API answered 404: Not found");
  });

  it.each([
    ["a body without a title", { detail: "x" }],
    ["a title that isn't text", { title: 7 }],
    ["no object at all", "oops"],
  ])("falls back to the status text for %s", async (_case, body) => {
    vi.stubGlobal("fetch", answer(body, { status: 503, statusText: "Service Unavailable" }));

    await expect(apiCall((api) => api.GET("/categories"))).rejects.toMatchObject({
      status: 503,
      title: "Service Unavailable",
    });
  });

  it("throws ApiUnavailableError, keeping the cause, when the API can't be reached", async () => {
    const cause = new TypeError("fetch failed");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(cause));

    const error = await apiCall((api) => api.GET("/categories")).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiUnavailableError);
    expect(error).toMatchObject({ message: "The API could not be reached", cause });
  });

  it("throws ApiUnavailableError when a call times out", async () => {
    const timeout = new DOMException("The operation timed out.", "TimeoutError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));

    await expect(apiCall((api) => api.GET("/categories"))).rejects.toMatchObject({
      name: "ApiUnavailableError",
      cause: timeout,
    });
  });

  it("passes on ApiUnavailableError as it is when API_URL is missing on the server", async () => {
    vi.stubEnv("API_URL", "");
    vi.stubGlobal("window", undefined);

    await expect(apiCall((api) => api.GET("/categories"))).rejects.toEqual(
      new ApiUnavailableError("API_URL is not set"),
    );
  });
});
