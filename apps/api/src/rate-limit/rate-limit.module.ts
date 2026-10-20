import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import type { Redis } from "ioredis";
import { ValkeyThrottlerStorage } from "./valkey-throttler.storage.js";
import { VALKEY, ValkeyModule } from "./valkey.module.js";

export const RATE_LIMIT = 100;
export const RATE_WINDOW_MS = 60_000;

// 100 requests a minute per visitor (their IP address), counted in Valkey.
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ValkeyModule],
      inject: [VALKEY],
      useFactory: (client: Redis) => ({
        throttlers: [{ ttl: RATE_WINDOW_MS, limit: RATE_LIMIT }],
        storage: new ValkeyThrottlerStorage(client),
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class RateLimitModule {}
