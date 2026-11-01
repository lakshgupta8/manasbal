import { Body, Controller, Inject, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { signUpInputSchema, type SignUpInput } from "@manasbal/types";
import { AUTH_RATE_LIMIT, RATE_WINDOW_MS } from "../rate-limit/rate-limit.module.js";
import { ApiZodBody, ZodValidationPipe } from "../validation/zod-validation.pipe.js";
import { AuthService } from "./auth.service.js";

// A class rather than an interface so the OpenAPI description (and the generated SDK) knows
// the shape of the answer. Never the password hash.
export class SignUpResult {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;
}

// Signing up and, later, signing in. The limit on the class covers every /auth/* route: it is
// far tighter than the API-wide one, to slow down password guessing and account spam.
@ApiTags("Auth")
@Throttle({ default: { limit: AUTH_RATE_LIMIT, ttl: RATE_WINDOW_MS } })
@Controller("auth")
export class AuthController {
  // Typed as the part it uses: a class type makes the decorator metadata emit a branch that never
  // runs. @Inject still names the provider.
  constructor(@Inject(AuthService) private readonly auth: Pick<AuthService, "signUp">) {}

  @Post("sign-up")
  @ApiOperation({
    summary: "Create an account",
    description: "Use made-up details. This is a demo.",
  })
  @ApiZodBody(signUpInputSchema)
  @ApiCreatedResponse({ type: SignUpResult })
  @ApiBadRequestResponse({ description: "Invalid details, or we could not create this account" })
  signUp(
    @Body(new ZodValidationPipe(signUpInputSchema)) input: SignUpInput,
  ): Promise<SignUpResult> {
    return this.auth.signUp(input);
  }
}
