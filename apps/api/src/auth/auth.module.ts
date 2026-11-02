import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";
import { PasswordService } from "./password.service.js";
import { TokensService } from "./tokens.service.js";

@Module({
  controllers: [AuthController],
  providers: [PasswordService, TokensService, AuthService, AuthGuard],
  exports: [PasswordService, TokensService, AuthGuard],
})
export class AuthModule {}
