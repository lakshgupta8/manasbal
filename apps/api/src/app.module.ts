import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { ProblemDetailsFilter } from "./errors/problem-details.filter.js";
import { HealthController } from "./health/health.controller.js";
import { loggingParams } from "./logging/logging.config.js";

@Module({
  imports: [LoggerModule.forRoot(loggingParams())],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
export class AppModule {}
