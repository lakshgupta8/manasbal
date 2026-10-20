import { Test } from "@nestjs/testing";
import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";
import { VALKEY, ValkeyModule } from "./valkey.module.js";

describe("ValkeyModule", () => {
  it("closes the Valkey connection on shutdown", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ValkeyModule] }).compile();
    const disconnect = vi.spyOn(moduleRef.get<Redis>(VALKEY), "disconnect");

    moduleRef.get(ValkeyModule).onApplicationShutdown();

    expect(disconnect).toHaveBeenCalledOnce();
  });
});
