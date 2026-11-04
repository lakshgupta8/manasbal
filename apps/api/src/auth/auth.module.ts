import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { MailModule } from "../mail/mail.module.js";
import { ValkeyModule } from "../valkey/valkey.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";
import { LockoutService } from "./lockout.service.js";
import { OriginGuard } from "./origin.guard.js";
import { PasswordService } from "./password.service.js";
import { RolesGuard } from "./roles.js";
import { TokensService } from "./tokens.service.js";
import { TwoStepController } from "./two-step.controller.js";
import { TwoStepService } from "./two-step.service.js";

@Module({
  // Auth events go to the audit log, and the lockout counts live in Valkey; importing both keeps
  // the module usable on its own.
  imports: [AuditModule, MailModule, ValkeyModule],
  controllers: [AuthController, TwoStepController],
  providers: [
    PasswordService,
    TokensService,
    AuthService,
    AuthGuard,
    RolesGuard,
    TwoStepService,
    LockoutService,
    OriginGuard,
  ],
  exports: [PasswordService, TokensService, AuthGuard, RolesGuard],
})
export class AuthModule {}
