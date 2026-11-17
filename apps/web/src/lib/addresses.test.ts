import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteAddress, listAddresses, saveAddress, type AddressInput } from "./addresses";
import { ApiResponseError } from "./api-errors";

// Made up: no real person or place.
const HOME = {
  id: "1a2b3c4d-0000-4000-8000-000000000001",
  name: "Test Buyer",
  line1: "12 Sample Lane",
  city: "Lakeside",
  state: "Example State",
  pincode: "190006",
  isDefault: true,
};
const INPUT: AddressInput = {
  name: HOME.name,
  line1: HOME.line1,
  city: HOME.city,
  state: HOME.state,
  pincode: HOME.pincode,
  isDefault: true,
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

describe("listAddresses", () => {
  it("asks for the visitor's addresses with their token", async () => {
    const fetchMock = api(200, [HOME]);

    await expect(listAddresses("t1")).resolves.toEqual({ kind: "listed", items: [HOME] });
    const [request] = fetchMock.mock.calls[0]!;
    expect(request.method).toBe("GET");
    expect(new URL(request.url).pathname).toBe("/api/me/addresses");
    expect(request.headers.get("authorization")).toBe("Bearer t1");
  });

  it("says when the token was refused, or there were too many tries", async () => {
    api(401);
    await expect(listAddresses("t1")).resolves.toEqual({ kind: "signedOut" });

    api(429, undefined, { "retry-after": "30" });
    await expect(listAddresses("t1")).resolves.toEqual({
      kind: "tooManyTries",
      retryAfterSeconds: 30,
    });
  });

  it("throws anything else", async () => {
    api(500);
    await expect(listAddresses("t1")).rejects.toBeInstanceOf(ApiResponseError);
  });
});

describe("saveAddress", () => {
  it("adds a new address", async () => {
    const fetchMock = api(201, HOME);

    await expect(saveAddress("t1", INPUT)).resolves.toEqual({ kind: "saved", address: HOME });
    const [request] = fetchMock.mock.calls[0]!;
    expect(request.method).toBe("POST");
    expect(new URL(request.url).pathname).toBe("/api/me/addresses");
    expect(await request.json()).toEqual(INPUT);
  });

  it("changes the address with this id", async () => {
    const fetchMock = api(200, HOME);

    await saveAddress("t1", INPUT, HOME.id);
    const [request] = fetchMock.mock.calls[0]!;
    expect(request.method).toBe("PATCH");
    expect(new URL(request.url).pathname).toBe(`/api/me/addresses/${HOME.id}`);
  });

  it("explains a refusal", async () => {
    api(400);
    await expect(saveAddress("t1", INPUT)).resolves.toEqual({ kind: "invalid" });
    api(404);
    await expect(saveAddress("t1", INPUT, HOME.id)).resolves.toEqual({ kind: "gone" });
    api(401);
    await expect(saveAddress("t1", INPUT)).resolves.toEqual({ kind: "signedOut" });
    api(500);
    await expect(saveAddress("t1", INPUT)).rejects.toBeInstanceOf(ApiResponseError);
  });
});

describe("deleteAddress", () => {
  it("deletes the address, and counts one already gone as deleted", async () => {
    const fetchMock = api(204);
    await expect(deleteAddress("t1", HOME.id)).resolves.toEqual({ kind: "deleted" });
    const [request] = fetchMock.mock.calls[0]!;
    expect(request.method).toBe("DELETE");
    expect(new URL(request.url).pathname).toBe(`/api/me/addresses/${HOME.id}`);

    api(404);
    await expect(deleteAddress("t1", HOME.id)).resolves.toEqual({ kind: "deleted" });
  });

  it("keeps an address an order was sent to", async () => {
    api(409);
    await expect(deleteAddress("t1", HOME.id)).resolves.toEqual({ kind: "inUse" });
  });

  it("explains a refusal, and throws anything else", async () => {
    api(401);
    await expect(deleteAddress("t1", HOME.id)).resolves.toEqual({ kind: "signedOut" });
    api(500);
    await expect(deleteAddress("t1", HOME.id)).rejects.toBeInstanceOf(ApiResponseError);
  });
});
