import { describe, expect, it, vi } from "vitest";
import {
  IDEMPOTENCY_TTL_MS,
  IN_PROGRESS_TTL_MS,
  IdempotencyStore,
  type KeyValueClient,
} from "./idempotency.store.js";

function fakeClient(overrides: Partial<Record<"set" | "get" | "del", unknown>> = {}) {
  const client = {
    set: vi.fn().mockResolvedValue("OK"),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
  return client;
}

const storeWith = (client: ReturnType<typeof fakeClient>) =>
  new IdempotencyStore(client as unknown as KeyValueClient);

describe("IdempotencyStore", () => {
  it("claims a new key for a short time", async () => {
    const client = fakeClient();

    await expect(storeWith(client).claim("k1", "fp")).resolves.toBeNull();
    expect(client.set).toHaveBeenCalledWith(
      "idempotency:k1",
      JSON.stringify({ fingerprint: "fp" }),
      "PX",
      IN_PROGRESS_TTL_MS,
      "NX",
    );
  });

  it("returns the record already stored under the key", async () => {
    const stored = { fingerprint: "fp", response: { status: 201, body: { id: 1 } } };
    const client = fakeClient({
      set: vi.fn().mockResolvedValue(null),
      get: vi.fn().mockResolvedValue(JSON.stringify(stored)),
    });

    await expect(storeWith(client).claim("k1", "fp")).resolves.toEqual(stored);
  });

  it("claims again when the earlier claim expired in between", async () => {
    const client = fakeClient({ set: vi.fn().mockResolvedValueOnce(null).mockResolvedValue("OK") });

    await expect(storeWith(client).claim("k1", "fp")).resolves.toBeNull();
    expect(client.set).toHaveBeenCalledTimes(2);
  });

  it("keeps the finished answer for 24 hours", async () => {
    const client = fakeClient();

    await storeWith(client).complete("k1", "fp", { status: 201, body: { id: 1 } });

    expect(client.set).toHaveBeenCalledWith(
      "idempotency:k1",
      JSON.stringify({ fingerprint: "fp", response: { status: 201, body: { id: 1 } } }),
      "PX",
      IDEMPOTENCY_TTL_MS,
    );
  });

  it("frees the key", async () => {
    const client = fakeClient();

    await storeWith(client).release("k1");

    expect(client.del).toHaveBeenCalledWith("idempotency:k1");
  });
});
