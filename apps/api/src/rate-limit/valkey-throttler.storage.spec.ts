import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ValkeyThrottlerStorage } from "./valkey-throttler.storage.js";

describe("ValkeyThrottlerStorage", () => {
  it("passes the window settings to Valkey and converts ms to seconds", async () => {
    const evalMock = vi.fn().mockResolvedValue([3, 59_500, 0, 0]);
    const storage = new ValkeyThrottlerStorage({ eval: evalMock });

    const record = await storage.increment("abc", 60_000, 100, 60_000, "default");

    expect(record).toEqual({
      totalHits: 3,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    expect(evalMock).toHaveBeenCalledWith(
      expect.any(String),
      2,
      "throttle:default:abc",
      "throttle:default:abc:blocked",
      60_000,
      100,
      60_000,
    );
  });

  it("reports a blocked visitor with the time left", async () => {
    const storage = new ValkeyThrottlerStorage({
      eval: vi.fn().mockResolvedValue([101, 20_000, 1, 20_000]),
    });

    const record = await storage.increment("abc", 60_000, 100, 60_000, "default");

    expect(record).toMatchObject({ isBlocked: true, timeToBlockExpire: 20 });
  });

  it("lets the request through when Valkey is down", async () => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const storage = new ValkeyThrottlerStorage({
      eval: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    });

    const record = await storage.increment("abc", 60_000, 100, 60_000, "default");

    expect(record.isBlocked).toBe(false);
    expect(record.totalHits).toBe(0);
  });
});
