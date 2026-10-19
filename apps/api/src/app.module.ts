import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { HealthController } from "./health/health.controller.js";
import { loggingParams } from "./logging/logging.config.js";

@Module({
  imports: [LoggerModule.forRoot(loggingParams())],
  controllers: [HealthController],
})
export class AppModule {}
