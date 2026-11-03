import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { MailModule } from "../mail/mail.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";
import { PasswordService } from "./password.service.js";
import { RolesGuard } from "./roles.js";
import { TokensService } from "./tokens.service.js";
import { TwoStepController } from "./two-step.controller.js";
import { TwoStepService } from "./two-step.service.js";

@Module({
  // TwoStepService records to the audit log; importing it keeps the module usable on its own.
  imports: [AuditModule, MailModule],
  controllers: [AuthController, TwoStepController],
  providers: [PasswordService, TokensService, AuthService, AuthGuard, RolesGuard, TwoStepService],
  exports: [PasswordService, TokensService, AuthGuard, RolesGuard],
})
export class AuthModule {}
