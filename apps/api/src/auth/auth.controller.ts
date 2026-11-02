import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  forgotPasswordInputSchema,
  resetPasswordInputSchema,
  signInInputSchema,
  signUpInputSchema,
  verifyEmailInputSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type SignInInput,
  type SignUpInput,
  type VerifyEmailInput,
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
  constructor(
    @Inject(AuthService)
    private readonly auth: Pick<
      AuthService,
      | "signUp"
      | "signIn"
      | "refresh"
      | "signOut"
      | "verifyEmail"
      | "forgotPassword"
      | "resetPassword"
    >,
  ) {}

  @Post("sign-up")
  @ApiOperation({
    summary: "Create an account",
    description:
      "Use made-up details. This is a demo. When mail is on, sends a link to confirm the email address.",
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
  @ApiForbiddenResponse({ description: "Check your email to confirm your account" })
  async signIn(
    @Body(new ZodValidationPipe(signInInputSchema)) input: SignInInput,
    @Headers("user-agent") userAgent: string | undefined,
    @Res({ passthrough: true }) reply: Pick<FastifyReply, "setCookie">,
  ): Promise<SignInResult> {
    const { refreshToken, ...answer } = await this.auth.signIn(input, userAgent);
    reply.setCookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    return answer;
  }

  @Post("verify-email")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Confirm an email address",
    description: "Takes the token from the link in the sign-up mail. Each link works once.",
  })
  @ApiZodBody(verifyEmailInputSchema)
  @ApiNoContentResponse({ description: "The account is confirmed" })
  @ApiBadRequestResponse({ description: "This link is not valid any more" })
  verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailInputSchema)) input: VerifyEmailInput,
  ): Promise<void> {
    return this.auth.verifyEmail(input.token);
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Ask for a password reset link",
    description:
      "Always answers 202, whether or not the email has an account; only an account gets the mail. The link works once, for 1 hour.",
  })
  @ApiZodBody(forgotPasswordInputSchema)
  @ApiAcceptedResponse({ description: "If the email has an account, a reset link is on its way" })
  @ApiBadRequestResponse({ description: "Not an email address" })
  forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordInputSchema)) input: ForgotPasswordInput,
  ): void {
    this.auth.forgotPassword(input.email);
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Set a new password",
    description:
      "Takes the token from the reset link and a new password. Each link works once, and every session of the account ends.",
  })
  @ApiZodBody(resetPasswordInputSchema)
  @ApiNoContentResponse({ description: "The password is changed; sign in again" })
  @ApiBadRequestResponse({
    description: "This link is not valid any more, or the password is too short or too long",
  })
  resetPassword(
    @Body(new ZodValidationPipe(resetPasswordInputSchema)) input: ResetPasswordInput,
  ): Promise<void> {
    return this.auth.resetPassword(input.token, input.password);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Renew the access token",
    description:
      "Swaps the refresh_token cookie for a new access token and a new cookie. Each cookie works once; using one twice signs out every copy.",
  })
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOkResponse({ type: SignInResult })
  @ApiUnauthorizedResponse({ description: "No usable refresh token: sign in again" })
  async refresh(
    @Req() request: Pick<FastifyRequest, "cookies">,
    @Headers("user-agent") userAgent: string | undefined,
    @Res({ passthrough: true }) reply: Pick<FastifyReply, "setCookie">,
  ): Promise<SignInResult> {
    const { refreshToken, ...answer } = await this.auth.refresh(
      request.cookies[REFRESH_COOKIE],
      userAgent,
    );
    reply.setCookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    return answer;
  }

  @Post("sign-out")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Sign out",
    description: "Revokes the session's refresh tokens and clears the cookie.",
  })
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiNoContentResponse()
  async signOut(
    @Req() request: Pick<FastifyRequest, "cookies">,
    @Res({ passthrough: true }) reply: Pick<FastifyReply, "clearCookie">,
  ): Promise<void> {
    await this.auth.signOut(request.cookies[REFRESH_COOKIE]);
    // The browser drops the cookie only when its path and flags match the ones it was set with;
    // clearCookie overrides the lifetime itself.
    reply.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
  }
}
