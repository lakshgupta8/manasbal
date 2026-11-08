import { afterEach, describe, expect, it, vi } from "vitest";
import { API_TIMEOUT_MS, ApiResponseError, ApiUnavailableError } from "./api-errors";
import {
  forgotPassword,
  me,
  refresh,
  resetPassword,
  retryAfterSeconds,
  SIGN_IN_AGAIN,
  signIn,
  signOut,
  signUp,
  verifyEmail,
  verifyTwoStep,
} from "./auth";

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
  vi.restoreAllMocks();
});

describe("every call", () => {
  it("sends JSON to the shop's own address, with a timeout", async () => {
    const fetchMock = api(200, SESSION);
    const timeout = vi.spyOn(AbortSignal, "timeout");

    await signIn("a@example.test", "p");

    const [request] = fetchMock.mock.calls[0]!;
    expect(request.headers.get("content-type")).toBe("application/json");
    expect(request.headers.has("authorization")).toBe(false);
    expect(timeout).toHaveBeenCalledWith(API_TIMEOUT_MS);
  });

  it("treats an answer that isn't JSON as having no body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>Bad gateway</html>", { status: 502 })),
    );

    await expect(refresh()).rejects.toEqual(new ApiResponseError(502, ""));
  });
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

describe("signUp", () => {
  const details = { name: "Asha Rao", email: "asha@example.test", password: "a long passphrase" };

  it.each([true, false])(
    "posts the details with the 18+ confirmation, and says whether the account is confirmed (%s)",
    async (emailConfirmed) => {
      const fetchMock = api(201, {
        id: "u2",
        email: details.email,
        name: details.name,
        emailConfirmed,
      });

      await expect(signUp(details)).resolves.toEqual({ kind: "created", emailConfirmed });
      const [request] = fetchMock.mock.calls[0]!;
      expect(request.url).toBe(`${window.location.origin}/auth/sign-up`);
      expect(await request.json()).toEqual({ ...details, confirmAdult: true });
    },
  );

  it("sends only the fields the API knows", async () => {
    const fetchMock = api(201, { emailConfirmed: true });

    await signUp({ ...details, adult: true } as typeof details);

    expect(Object.keys(await fetchMock.mock.calls[0]![0].json())).toEqual([
      "name",
      "email",
      "password",
      "confirmAdult",
    ]);
  });

  it("is refused without saying why when the details or the email won't do", async () => {
    api(400, { title: "We could not create this account" });

    await expect(signUp(details)).resolves.toEqual({ kind: "refused" });
  });

  it("says how long to wait after too many tries", async () => {
    api(429, { title: "Too many" }, { "retry-after": "60" });

    await expect(signUp(details)).resolves.toEqual({ kind: "tooManyTries", retryAfterSeconds: 60 });
  });

  it("throws on any other answer", async () => {
    api(500, { title: "Broken" });

    await expect(signUp(details)).rejects.toBeInstanceOf(ApiResponseError);
  });
});

describe("verifyEmail", () => {
  it("posts the token from the link and answers true when the email is confirmed", async () => {
    const fetchMock = api(204);

    await expect(verifyEmail("link-token")).resolves.toBe(true);
    const [request] = fetchMock.mock.calls[0]!;
    expect(request.url).toBe(`${window.location.origin}/auth/verify-email`);
    expect(await request.json()).toEqual({ token: "link-token" });
  });

  it("answers false when the link is not valid any more", async () => {
    api(400, { title: "This link is not valid any more" });

    await expect(verifyEmail("used")).resolves.toBe(false);
  });

  it("throws on any other answer", async () => {
    api(503, { title: "Down" });

    await expect(verifyEmail("t")).rejects.toBeInstanceOf(ApiResponseError);
  });
});

describe("verifyTwoStep", () => {
  it("sends the code with the challenge and answers the session", async () => {
    const fetchMock = api(200, SESSION);

    await expect(verifyTwoStep("challenge", "123456")).resolves.toEqual({
      kind: "signedIn",
      session: SESSION,
    });
    const [request] = fetchMock.mock.calls[0]!;
    expect(request.url).toBe(`${window.location.origin}/auth/2fa/verify`);
    expect(await request.json()).toEqual({ challengeToken: "challenge", code: "123456" });
  });

  it.each([
    [400, { detail: "code: Enter the code" }],
    [401, { detail: "That code is not right. Check the time on your phone and try again" }],
    [401, "not json"],
  ])("calls a %i a wrong code", async (status, body) => {
    api(status, body);

    await expect(verifyTwoStep("challenge", "000000")).resolves.toEqual({ kind: "wrongCode" });
  });

  it("asks to sign in again when the challenge can't be used any more", async () => {
    api(401, { detail: SIGN_IN_AGAIN });

    await expect(verifyTwoStep("old", "123456")).resolves.toEqual({ kind: "signInAgain" });
  });

  it("says how long to wait after too many wrong codes", async () => {
    api(429, { title: "Too many" }, { "retry-after": "900" });

    await expect(verifyTwoStep("c", "123456")).resolves.toEqual({
      kind: "tooManyTries",
      retryAfterSeconds: 900,
    });
  });

  it("throws on any other answer", async () => {
    api(500, { title: "Broken" });

    await expect(verifyTwoStep("c", "123456")).rejects.toBeInstanceOf(ApiResponseError);
  });
});

describe("forgotPassword", () => {
  it.each([202, 400])(
    "says the same thing whatever the API answers about the email (%i)",
    async (status) => {
      const fetchMock = api(status, status === 400 ? { title: "Bad Request" } : undefined);

      await expect(forgotPassword("anyone@example.test")).resolves.toEqual({ kind: "sent" });
      const [request] = fetchMock.mock.calls[0]!;
      expect(request.url).toBe(`${window.location.origin}/auth/forgot-password`);
      expect(await request.json()).toEqual({ email: "anyone@example.test" });
    },
  );

  it("says how long to wait after too many tries", async () => {
    api(429, { title: "Too many" }, { "retry-after": "30" });

    await expect(forgotPassword("a@example.test")).resolves.toEqual({
      kind: "tooManyTries",
      retryAfterSeconds: 30,
    });
  });

  it("throws on any other answer", async () => {
    api(502, { title: "Bad gateway" });

    await expect(forgotPassword("a@example.test")).rejects.toBeInstanceOf(ApiResponseError);
  });
});

describe("resetPassword", () => {
  it("sends the token and the new password", async () => {
    const fetchMock = api(204);

    await expect(resetPassword("link-token", "a new passphrase")).resolves.toEqual({
      kind: "changed",
    });
    const [request] = fetchMock.mock.calls[0]!;
    expect(request.url).toBe(`${window.location.origin}/auth/reset-password`);
    expect(await request.json()).toEqual({ token: "link-token", password: "a new passphrase" });
  });

  it("says the link is not valid any more on a 400", async () => {
    api(400, { detail: "This link is not valid any more" });

    await expect(resetPassword("used", "a new passphrase")).resolves.toEqual({
      kind: "linkInvalid",
    });
  });

  it("says how long to wait after too many tries", async () => {
    api(429, { title: "Too many" });

    await expect(resetPassword("t", "a new passphrase")).resolves.toEqual({
      kind: "tooManyTries",
      retryAfterSeconds: undefined,
    });
  });

  it("throws on any other answer", async () => {
    api(500, { title: "Broken" });

    await expect(resetPassword("t", "a new passphrase")).rejects.toBeInstanceOf(ApiResponseError);
  });
});
