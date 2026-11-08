import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError, ApiUnavailableError } from "./api";
import { me, refresh, retryAfterSeconds, signIn, signOut } from "./auth";

const SESSION = { accessToken: "token-from-the-api", expiresIn: 900 };
const ME = { id: "u1", email: "customer@example.com", name: "Demo Customer", role: "customer" };

// The API answers each call with `status`, `body` and `headers`.
function api(status: number, body?: unknown, headers: Record<string, string> = {}) {
  const fetchMock = vi.fn<(request: Request) => Promise<Response>>(async () =>
    body === undefined
      ? new Response(null, { status, headers })
      : Response.json(body, { status, headers }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signIn", () => {
  it("posts the email and password to the shop's /auth/sign-in and answers the session", async () => {
    const fetchMock = api(200, SESSION);

    await expect(signIn("customer@example.com", "a-password")).resolves.toEqual({
      kind: "signedIn",
      session: SESSION,
    });
    const [request] = fetchMock.mock.calls[0]!;
    expect(request.url).toBe(`${window.location.origin}/auth/sign-in`);
    expect(await request.json()).toEqual({ email: "customer@example.com", password: "a-password" });
  });

  it("answers the challenge when the account uses two-step sign-in", async () => {
    api(200, { twoFactorRequired: true, challengeToken: "challenge" });

    await expect(signIn("a@example.test", "p")).resolves.toEqual({
      kind: "twoStep",
      challengeToken: "challenge",
    });
  });

  it.each([
    [400, "invalid"],
    [401, "wrongPassword"],
    [403, "notConfirmed"],
  ])("turns %i into %s", async (status, kind) => {
    api(status, { title: "No" });

    await expect(signIn("a@example.test", "p")).resolves.toEqual({ kind });
  });

  it("says how long to wait after too many tries, from Retry-After", async () => {
    api(429, { title: "Too many" }, { "retry-after": "900" });

    await expect(signIn("a@example.test", "p")).resolves.toEqual({
      kind: "tooManyTries",
      retryAfterSeconds: 900,
    });
  });

  it("leaves the wait out when the API doesn't say", async () => {
    api(429, { title: "Too many" });

    await expect(signIn("a@example.test", "p")).resolves.toEqual({
      kind: "tooManyTries",
      retryAfterSeconds: undefined,
    });
  });

  it("throws on an answer it can't explain", async () => {
    api(500, { title: "Broken" });

    await expect(signIn("a@example.test", "p")).rejects.toBeInstanceOf(ApiResponseError);
  });

  it("throws ApiUnavailableError when the API can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(signIn("a@example.test", "p")).rejects.toBeInstanceOf(ApiUnavailableError);
  });
});

describe("retryAfterSeconds", () => {
  it("reads whole seconds", () => {
    expect(retryAfterSeconds("120")).toBe(120);
    expect(retryAfterSeconds("0")).toBe(0);
  });

  it("reads an HTTP date as the seconds from now, never below zero", () => {
    const now = Date.parse("2026-11-08T10:00:00Z");
    expect(retryAfterSeconds("Sun, 08 Nov 2026 10:01:30 GMT", now)).toBe(90);
    expect(retryAfterSeconds("Sun, 08 Nov 2026 09:00:00 GMT", now)).toBe(0);
  });

  it("is undefined when missing, empty or unreadable", () => {
    expect(retryAfterSeconds(null)).toBeUndefined();
    expect(retryAfterSeconds(" ")).toBeUndefined();
    expect(retryAfterSeconds("soon")).toBeUndefined();
    expect(retryAfterSeconds("-5")).toBeUndefined();
  });
});

describe("refresh", () => {
  it("swaps the cookie at the shop's /auth/refresh for a session", async () => {
    const fetchMock = api(200, SESSION);

    await expect(refresh()).resolves.toEqual(SESSION);
    expect(fetchMock.mock.calls[0]![0].url).toBe(`${window.location.origin}/auth/refresh`);
  });

  it.each([401, 403])("answers null when there is no usable cookie (%i)", async (status) => {
    api(status, { title: "No" });

    await expect(refresh()).resolves.toBeNull();
  });

  it("throws on any other answer", async () => {
    api(502, { title: "Bad gateway" });

    await expect(refresh()).rejects.toBeInstanceOf(ApiResponseError);
  });
});

describe("signOut", () => {
  it("posts to the shop's /auth/sign-out", async () => {
    const fetchMock = api(204);

    await expect(signOut()).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0]![0].url).toBe(`${window.location.origin}/auth/sign-out`);
    expect(fetchMock.mock.calls[0]![0].method).toBe("POST");
  });

  it("throws when the API refuses", async () => {
    api(403, { title: "This request must come from the Manasbal shop" });

    await expect(signOut()).rejects.toBeInstanceOf(ApiResponseError);
  });
});

describe("me", () => {
  it("asks who is signed in with the access token", async () => {
    const fetchMock = api(200, ME);

    await expect(me("token-from-memory")).resolves.toEqual(ME);
    const [request] = fetchMock.mock.calls[0]!;
    expect(request.url).toBe(`${window.location.origin}/api/me`);
    expect(request.headers.get("authorization")).toBe("Bearer token-from-memory");
  });

  it("throws when the token is refused", async () => {
    api(401, { title: "Sign in again" });

    await expect(me("old")).rejects.toBeInstanceOf(ApiResponseError);
  });
});
