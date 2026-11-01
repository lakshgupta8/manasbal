import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { PasswordService } from "./password.service.js";

@Module({
  controllers: [AuthController],
  providers: [PasswordService, AuthService],
  exports: [PasswordService],
})
export class AuthModule {}
