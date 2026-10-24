import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { ProblemDetailsFilter } from "./errors/problem-details.filter.js";
import { AdminModule } from "./admin/admin.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { CartModule } from "./cart/cart.module.js";
import { IdempotencyModule } from "./idempotency/idempotency.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { HealthController } from "./health/health.controller.js";
import { loggingParams } from "./logging/logging.config.js";
import { OrdersModule } from "./orders/orders.module.js";
import { RateLimitModule } from "./rate-limit/rate-limit.module.js";
import { ReviewsModule } from "./reviews/reviews.module.js";
import { SellersModule } from "./sellers/sellers.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [
    LoggerModule.forRoot(loggingParams()),
    RateLimitModule,
    IdempotencyModule,
    AuditModule,
    UsersModule,
    CatalogModule,
    SellersModule,
    ReviewsModule,
    CartModule,
    OrdersModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
export class AppModule {}
