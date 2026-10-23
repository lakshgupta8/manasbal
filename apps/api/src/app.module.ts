import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { ProblemDetailsFilter } from "./errors/problem-details.filter.js";
import { IdempotencyModule } from "./idempotency/idempotency.module.js";
import { HealthController } from "./health/health.controller.js";
import { loggingParams } from "./logging/logging.config.js";
import { RateLimitModule } from "./rate-limit/rate-limit.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [LoggerModule.forRoot(loggingParams()), RateLimitModule, IdempotencyModule, UsersModule],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
export class AppModule {}
