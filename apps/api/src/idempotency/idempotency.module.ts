import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ValkeyModule } from "../valkey/valkey.module.js";
import { IdempotencyInterceptor } from "./idempotency.interceptor.js";
import { IdempotencyStore } from "./idempotency.store.js";

@Module({
  imports: [ValkeyModule],
  providers: [IdempotencyStore, { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor }],
})
export class IdempotencyModule {}
