import {
  BadRequestException,
  ConflictException,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
  type CallHandler,
  type ExecutionContext,
} from "@nestjs/common";
import { firstValueFrom, of, throwError } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import { IdempotencyInterceptor } from "./idempotency.interceptor.js";
import type { IdempotencyRecord } from "./idempotency.store.js";

interface FakeRequest {
  method: string;
  url: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}

function setup(request: Partial<FakeRequest>, claimed: IdempotencyRecord | null | Error = null) {
  const store = {
    claim: vi.fn(() =>
      claimed instanceof Error ? Promise.reject(claimed) : Promise.resolve(claimed),
    ),
    complete: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
  };
  const reply = { statusCode: 201, status: vi.fn(), header: vi.fn() };
  reply.status.mockReturnValue(reply);
  const fullRequest: FakeRequest = { method: "POST", url: "/orders", headers: {}, ...request };
  const context = {
    switchToHttp: () => ({ getRequest: () => fullRequest, getResponse: () => reply }),
  } as unknown as ExecutionContext;
  const interceptor = new IdempotencyInterceptor(store);
  return { store, reply, context, interceptor };
}

function handler(body: unknown = { id: 1 }) {
  return { handle: vi.fn(() => of(body)) } satisfies CallHandler;
}

// Runs one keyed request through a fresh interceptor and returns the fingerprint it stored.
async function fingerprintFor(request: Partial<FakeRequest>): Promise<string> {
  const { store, context, interceptor } = setup(request);
  await firstValueFrom(interceptor.intercept(context, handler()));
  return store.complete.mock.calls[0]![1] as string;
}

const keyed = { headers: { "idempotency-key": "k" } };

describe("IdempotencyInterceptor", () => {
  it("does nothing without a key", async () => {
    const { store, context, interceptor } = setup({});

    await expect(firstValueFrom(interceptor.intercept(context, handler()))).resolves.toEqual({
      id: 1,
    });
    expect(store.claim).not.toHaveBeenCalled();
  });

  it("ignores keys on reads", async () => {
    const { store, context, interceptor } = setup({ ...keyed, method: "GET" });

    await firstValueFrom(interceptor.intercept(context, handler()));

    expect(store.claim).not.toHaveBeenCalled();
  });

  it.each([[""], ["x".repeat(256)], [["a", "b"]]])("rejects the key %j", (key) => {
    const { context, interceptor } = setup({ headers: { "idempotency-key": key } });

    expect(() => interceptor.intercept(context, handler())).toThrow(BadRequestException);
  });

  it("does the work once and stores the answer", async () => {
    const { store, context, interceptor } = setup(keyed);
    const next = handler();

    await expect(firstValueFrom(interceptor.intercept(context, next))).resolves.toEqual({ id: 1 });
    expect(next.handle).toHaveBeenCalledOnce();
    expect(store.complete).toHaveBeenCalledWith("k", expect.any(String), {
      status: 201,
      body: { id: 1 },
    });
  });

  it("replays the stored answer without doing the work", async () => {
    const request = { ...keyed, body: { qty: 2 } };
    const fingerprint = await fingerprintFor(request);
    const { reply, context, interceptor } = setup(request, {
      fingerprint,
      response: { status: 201, body: { id: 1 } },
    });
    const next = handler({ id: 2 });

    await expect(firstValueFrom(interceptor.intercept(context, next))).resolves.toEqual({ id: 1 });
    expect(next.handle).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(201);
    expect(reply.header).toHaveBeenCalledWith("idempotent-replayed", "true");
  });

  it("refuses the same key for a different request", async () => {
    const { context, interceptor } = setup(keyed, {
      fingerprint: "another request",
      response: { status: 201, body: {} },
    });

    await expect(firstValueFrom(interceptor.intercept(context, handler()))).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it("refuses a repeat while the first request is still running", async () => {
    const fingerprint = await fingerprintFor(keyed);
    const { context, interceptor } = setup(keyed, { fingerprint });

    await expect(firstValueFrom(interceptor.intercept(context, handler()))).rejects.toThrow(
      ConflictException,
    );
  });

  it("frees the key when the work fails", async () => {
    const { store, context, interceptor } = setup(keyed);
    const failing = { handle: () => throwError(() => new Error("boom")) };

    await expect(firstValueFrom(interceptor.intercept(context, failing))).rejects.toThrow("boom");
    expect(store.release).toHaveBeenCalledWith("k");
    expect(store.complete).not.toHaveBeenCalled();
  });

  it("still reports the original error if freeing the key fails", async () => {
    const { store, context, interceptor } = setup(keyed);
    store.release.mockRejectedValue(new Error("valkey down"));
    const failing = { handle: () => throwError(() => new Error("boom")) };

    await expect(firstValueFrom(interceptor.intercept(context, failing))).rejects.toThrow("boom");
  });

  it("refuses with 503 when Valkey is down", async () => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const { context, interceptor } = setup(keyed, new Error("ECONNREFUSED"));
    const next = handler();

    await expect(firstValueFrom(interceptor.intercept(context, next))).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(next.handle).not.toHaveBeenCalled();
  });
});
