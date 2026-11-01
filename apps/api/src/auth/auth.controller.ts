import { Body, Controller, Headers, HttpCode, HttpStatus, Inject, Post, Res } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { FastifyReply } from "fastify";
import {
  signInInputSchema,
  signUpInputSchema,
  type SignInInput,
  type SignUpInput,
} from "@manasbal/types";
import { AUTH_RATE_LIMIT, RATE_WINDOW_MS } from "../rate-limit/rate-limit.module.js";
import { ApiZodBody, ZodValidationPipe } from "../validation/zod-validation.pipe.js";
import { AuthService } from "./auth.service.js";
import { REFRESH_COOKIE, refreshCookieOptions } from "./cookie.js";

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

// The refresh token is never in the body: it goes only into the httpOnly cookie.
export class SignInResult {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ description: "Seconds until the access token expires", example: 900 })
  expiresIn: number;
}

// Signing up and, later, signing in. The limit on the class covers every /auth/* route: it is
// far tighter than the API-wide one, to slow down password guessing and account spam.
@ApiTags("Auth")
@Throttle({ default: { limit: AUTH_RATE_LIMIT, ttl: RATE_WINDOW_MS } })
@Controller("auth")
export class AuthController {
  // Typed as the part it uses: a class type makes the decorator metadata emit a branch that never
  // runs. @Inject still names the provider.
  constructor(@Inject(AuthService) private readonly auth: Pick<AuthService, "signUp" | "signIn">) {}

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

  @Post("sign-in")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Sign in",
    description: "Answers an access token and sets the refresh_token cookie.",
  })
  @ApiZodBody(signInInputSchema)
  @ApiOkResponse({ type: SignInResult })
  @ApiUnauthorizedResponse({ description: "Email or password is wrong" })
  async signIn(
    @Body(new ZodValidationPipe(signInInputSchema)) input: SignInInput,
    @Headers("user-agent") userAgent: string | undefined,
    @Res({ passthrough: true }) reply: Pick<FastifyReply, "setCookie">,
  ): Promise<SignInResult> {
    const { refreshToken, ...answer } = await this.auth.signIn(input, userAgent);
    reply.setCookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    return answer;
  }
}
