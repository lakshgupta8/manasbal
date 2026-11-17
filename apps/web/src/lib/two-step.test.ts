import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError } from "./api-errors";
import { disableTwoStep, enableTwoStep, startTwoStep } from "./two-step";

// Made up: not a key anyone uses.
const SETUP = {
  otpauthUrl: "otpauth://totp/Manasbal:test%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Manasbal",
  secret: "JBSWY3DPEHPK3PXP",
};

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

describe("startTwoStep", () => {
  it("asks for a new secret with the visitor's token", async () => {
    const fetchMock = api(200, SETUP);

    await expect(startTwoStep("t1")).resolves.toEqual({ kind: "started", setup: SETUP });
    const [request] = fetchMock.mock.calls[0]!;
    expect(request.method).toBe("POST");
    expect(new URL(request.url).pathname).toBe("/auth/2fa/setup");
    expect(request.headers.get("authorization")).toBe("Bearer t1");
  });

  it("says when it is a demo login, or two-step is already on", async () => {
    api(403);
    await expect(startTwoStep("t1")).resolves.toEqual({ kind: "demo" });

    api(409);
    await expect(startTwoStep("t1")).resolves.toEqual({ kind: "alreadyOn" });
  });

  it("says when the token was refused, and throws anything else", async () => {
    api(401);
    await expect(startTwoStep("t1")).resolves.toEqual({ kind: "signedOut" });

    api(500);
    await expect(startTwoStep("t1")).rejects.toBeInstanceOf(ApiResponseError);
  });
});

describe("enableTwoStep", () => {
  it("sends the code and answers the recovery codes", async () => {
    const fetchMock = api(200, { recoveryCodes: ["aaaa-bbbb", "cccc-dddd"] });

    await expect(enableTwoStep("t1", "123456")).resolves.toEqual({
      kind: "on",
      recoveryCodes: ["aaaa-bbbb", "cccc-dddd"],
    });
    const [request] = fetchMock.mock.calls[0]!;
    expect(request.method).toBe("POST");
    expect(new URL(request.url).pathname).toBe("/auth/2fa/enable");
    expect(await request.json()).toEqual({ code: "123456" });
  });

  it("says a wrong code, a change made elsewhere, or a wait", async () => {
    api(400);
    await expect(enableTwoStep("t1", "000000")).resolves.toEqual({ kind: "wrongCode" });

    api(409);
    await expect(enableTwoStep("t1", "000000")).resolves.toEqual({ kind: "changed" });

    api(429, undefined, { "retry-after": "60" });
    await expect(enableTwoStep("t1", "000000")).resolves.toEqual({
      kind: "tooManyTries",
      retryAfterSeconds: 60,
    });
  });

  it("throws anything else", async () => {
    api(500);
    await expect(enableTwoStep("t1", "000000")).rejects.toBeInstanceOf(ApiResponseError);
  });
});

describe("disableTwoStep", () => {
  it("sends the code and switches two-step off", async () => {
    const fetchMock = api(204);

    await expect(disableTwoStep("t1", "aaaa-bbbb")).resolves.toEqual({ kind: "off" });
    const [request] = fetchMock.mock.calls[0]!;
    expect(new URL(request.url).pathname).toBe("/auth/2fa/disable");
    expect(await request.json()).toEqual({ code: "aaaa-bbbb" });
  });

  it("says a wrong code, or that the token was refused", async () => {
    api(400);
    await expect(disableTwoStep("t1", "000000")).resolves.toEqual({ kind: "wrongCode" });

    api(401);
    await expect(disableTwoStep("t1", "000000")).resolves.toEqual({ kind: "signedOut" });
  });
});
