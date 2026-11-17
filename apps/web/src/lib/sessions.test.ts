import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError } from "./api-errors";
import { endSession, listSessions } from "./sessions";

// Made up.
const THIS_ONE = {
  id: "5e550000-0000-4000-8000-000000000001",
  browser: "Firefox on Linux",
  startedAt: "2026-11-01T10:00:00.000Z",
  lastUsedAt: "2026-11-17T09:30:00.000Z",
  current: true,
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

describe("listSessions", () => {
  it("asks for the visitor's sessions with their token", async () => {
    const fetchMock = api(200, [THIS_ONE]);

    await expect(listSessions("t1")).resolves.toEqual({ kind: "listed", items: [THIS_ONE] });
    const [request] = fetchMock.mock.calls[0]!;
    expect(request.method).toBe("GET");
    expect(new URL(request.url).pathname).toBe("/api/me/sessions");
    expect(request.headers.get("authorization")).toBe("Bearer t1");
  });

  it("says when the token was refused, or there were too many tries", async () => {
    api(401);
    await expect(listSessions("t1")).resolves.toEqual({ kind: "signedOut" });

    api(429, undefined, { "retry-after": "30" });
    await expect(listSessions("t1")).resolves.toEqual({
      kind: "tooManyTries",
      retryAfterSeconds: 30,
    });
  });

  it("throws anything else", async () => {
    api(500);
    await expect(listSessions("t1")).rejects.toBeInstanceOf(ApiResponseError);
  });
});

describe("endSession", () => {
  it("ends the session with this id", async () => {
    const fetchMock = api(204);

    await expect(endSession("t1", "a/b")).resolves.toEqual({ kind: "ended" });
    const [request] = fetchMock.mock.calls[0]!;
    expect(request.method).toBe("DELETE");
    expect(new URL(request.url).pathname).toBe("/api/me/sessions/a%2Fb");
    expect(request.headers.get("authorization")).toBe("Bearer t1");
  });

  it("counts a session that has already ended as ended", async () => {
    api(404);
    await expect(endSession("t1", THIS_ONE.id)).resolves.toEqual({ kind: "ended" });
  });

  it("says when the token was refused, and throws anything else", async () => {
    api(401);
    await expect(endSession("t1", THIS_ONE.id)).resolves.toEqual({ kind: "signedOut" });

    api(500);
    await expect(endSession("t1", THIS_ONE.id)).rejects.toBeInstanceOf(ApiResponseError);
  });
});
