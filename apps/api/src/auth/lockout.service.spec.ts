import { Logger } from "@nestjs/common";
import { TooManyTriesException } from "../errors/too-many-tries.exception.js";
import {
  challengeLockKey,
  emailLockKey,
  LOCKED_OUT,
  LOCKOUT_LIMIT,
  LOCKOUT_MS,
  LockoutService,
  userLockKey,
} from "./lockout.service.js";

const KEY = "lockout:email:abc";

describe("LockoutService", () => {
  const evalMock =
    vi.fn<(script: string, numKeys: number, ...args: unknown[]) => Promise<unknown>>();
  const service = new LockoutService({ eval: evalMock });

  beforeEach(() => {
    evalMock.mockReset();
  });

  it("keys an email by the hash of its trimmed, lower-case form, never the email", () => {
    const key = emailLockKey(" Asha@Example.TEST ");

    expect(key).toBe(emailLockKey("asha@example.test"));
    expect(key).toMatch(/^lockout:email:[0-9a-f]{64}$/);
    expect(key).not.toContain("asha");
    expect(userLockKey("7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d")).toMatch(
      /^lockout:user:[0-9a-f]{64}$/,
    );
  });

  it("keys a sign-in challenge by the hash of its id", () => {
    const key = challengeLockKey("0f1e2d3c-4b5a-4968-8776-655443322110");

    expect(key).toMatch(/^lockout:challenge:[0-9a-f]{64}$/);
    expect(key).not.toContain("0f1e2d3c");
    expect(key).not.toBe(challengeLockKey("another-challenge"));
  });

  it("says a key is locked only once it has 5 failures", async () => {
    evalMock.mockResolvedValueOnce([LOCKOUT_LIMIT - 1, 600_000]);
    evalMock.mockResolvedValueOnce([LOCKOUT_LIMIT, 600_000]);

    await expect(service.isLocked(KEY)).resolves.toBe(false);
    await expect(service.isLocked(KEY)).resolves.toBe(true);
    expect(evalMock).toHaveBeenCalledWith(expect.any(String), 1, KEY);
  });

  it("lets a key with fewer than 5 failures through", async () => {
    evalMock.mockResolvedValue([LOCKOUT_LIMIT - 1, 600_000]);

    await expect(service.assertOpen(KEY)).resolves.toBeUndefined();
    expect(evalMock).toHaveBeenCalledWith(expect.any(String), 1, KEY);
  });

  it("answers 429 with the time left once a key is locked", async () => {
    evalMock.mockResolvedValue([LOCKOUT_LIMIT, 61_500]);

    const error = await service.assertOpen(KEY).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TooManyTriesException);
    expect((error as TooManyTriesException).getStatus()).toBe(429);
    expect((error as TooManyTriesException).message).toBe(LOCKED_OUT);
    expect((error as TooManyTriesException).retryAfterSeconds).toBe(62);
  });

  it("asks to wait at least a second when the lock is about to end", async () => {
    evalMock.mockResolvedValue([LOCKOUT_LIMIT, 0]);

    await expect(service.assertOpen(KEY)).rejects.toMatchObject({ retryAfterSeconds: 1 });
  });

  it("counts a failure with the window and the limit, and says when it locked the key", async () => {
    evalMock.mockResolvedValueOnce(4).mockResolvedValueOnce(LOCKOUT_LIMIT);

    await expect(service.fail(KEY)).resolves.toBe(false);
    await expect(service.fail(KEY)).resolves.toBe(true);
    expect(evalMock).toHaveBeenCalledWith(expect.any(String), 1, KEY, LOCKOUT_MS, LOCKOUT_LIMIT);
  });

  it("clears a key", async () => {
    evalMock.mockResolvedValue(1);

    await service.clear(KEY);

    expect(evalMock).toHaveBeenCalledWith(expect.stringContaining("DEL"), 1, KEY);
  });

  it("lets everything through when Valkey is down", async () => {
    const logged = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    evalMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(service.assertOpen(KEY)).resolves.toBeUndefined();
    await expect(service.isLocked(KEY)).resolves.toBe(false);
    await expect(service.fail(KEY)).resolves.toBe(false);
    await expect(service.clear(KEY)).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledTimes(4);
    expect(String(logged.mock.calls[0]?.[0])).not.toContain(KEY);
  });
});
