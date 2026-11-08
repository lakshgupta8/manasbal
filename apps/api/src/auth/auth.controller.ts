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
  UseGuards,
} from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  forgotPasswordInputSchema,
  resetPasswordInputSchema,
  signInInputSchema,
  signUpInputSchema,
  twoStepVerifyInputSchema,
  verifyEmailInputSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type SignInInput,
  type SignUpInput,
  type TwoStepVerifyInput,
  type VerifyEmailInput,
} from "@manasbal/types";
import { AUTH_RATE_LIMIT, RATE_WINDOW_MS } from "../rate-limit/rate-limit.module.js";
import { ApiZodBody, ZodValidationPipe } from "../validation/zod-validation.pipe.js";
import { AuthService } from "./auth.service.js";
import { REFRESH_COOKIE, refreshCookieOptions } from "./cookie.js";
import { ORIGIN_REFUSED, OriginGuard } from "./origin.guard.js";

const ORIGIN_REFUSED_DOC = `${ORIGIN_REFUSED}: the Origin header is not in WEB_ORIGINS, or is missing while the refresh_token cookie is sent`;

// A class rather than an interface so the OpenAPI description (and the generated SDK) knows
// the shape of the answer. Never the password hash.
export class SignUpResult {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    description:
      "True when the account can sign in now (mail is off); false when a link to confirm the email was mailed",
  })
  emailConfirmed: boolean;
}

// The refresh token is never in the body: it goes only into the httpOnly cookie.
export class SignInResult {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ description: "Seconds until the access token expires", example: 900 })
  expiresIn: number;
}

// Sign-in's answer when the password is right and two-step sign-in is on: no tokens and no
// cookie yet. Mirrors twoStepChallengeSchema in @manasbal/types.
export class TwoStepChallengeResult {
  @ApiProperty({ enum: [true] })
  twoFactorRequired: true;

  @ApiProperty({
    description: "Send it with the code to POST /auth/2fa/verify. It works for 5 minutes.",
  })
  challengeToken: string;
}

// The refresh token goes into the cookie; the rest is the answer.
function signedIn(
  { refreshToken, ...answer }: SignInResult & { refreshToken: string },
  reply: Pick<FastifyReply, "setCookie">,
): SignInResult {
  reply.setCookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  return answer;
}

// Signing up and, later, signing in. The limit on the class covers every /auth/* route: it is
// far tighter than the API-wide one, to slow down password guessing and account spam.
@ApiTags("Auth")
@ApiExtraModels(SignInResult, TwoStepChallengeResult)
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
      | "verifyTwoStep"
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
    @Req() request: Pick<FastifyRequest, "id">,
  ): Promise<SignUpResult> {
    return this.auth.signUp(input, String(request.id));
  }

  @Post("sign-in")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Sign in",
    description:
      "Answers an access token and sets the refresh_token cookie. With two-step sign-in on, answers only a challenge for POST /auth/2fa/verify instead.",
  })
  @ApiZodBody(signInInputSchema)
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(SignInResult) },
        { $ref: getSchemaPath(TwoStepChallengeResult) },
      ],
    },
  })
  @ApiUnauthorizedResponse({ description: "Email or password is wrong" })
  @ApiTooManyRequestsResponse({
    description: "5 wrong tries for this email in 15 minutes: wait 15 minutes",
  })
  @ApiForbiddenResponse({ description: "Check your email to confirm your account" })
  async signIn(
    @Body(new ZodValidationPipe(signInInputSchema)) input: SignInInput,
    @Headers("user-agent") userAgent: string | undefined,
    @Req() request: Pick<FastifyRequest, "id">,
    @Res({ passthrough: true }) reply: Pick<FastifyReply, "setCookie">,
  ): Promise<SignInResult | TwoStepChallengeResult> {
    const result = await this.auth.signIn(input, userAgent, String(request.id));
    if ("challengeToken" in result) return result;
    return signedIn(result, reply);
  }

  @Post("2fa/verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Second step of sign-in",
    description:
      "Takes the challenge sign-in answered and the 6-digit code from the authenticator app, or a recovery code. Each code works once, and a challenge allows at most 5 wrong codes. Answers an access token and sets the refresh_token cookie, as sign-in does.",
  })
  @ApiZodBody(twoStepVerifyInputSchema)
  @ApiOkResponse({ type: SignInResult })
  @ApiUnauthorizedResponse({
    description:
      "The code is not right, or sign in again (also after 5 wrong codes on one challenge)",
  })
  @ApiTooManyRequestsResponse({
    description: "5 wrong codes for this account in 15 minutes: wait 15 minutes",
  })
  async verifyTwoStep(
    @Body(new ZodValidationPipe(twoStepVerifyInputSchema)) input: TwoStepVerifyInput,
    @Headers("user-agent") userAgent: string | undefined,
    @Req() request: Pick<FastifyRequest, "id">,
    @Res({ passthrough: true }) reply: Pick<FastifyReply, "setCookie">,
  ): Promise<SignInResult> {
    return signedIn(await this.auth.verifyTwoStep(input, userAgent, String(request.id)), reply);
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
    @Req() request: Pick<FastifyRequest, "id">,
  ): Promise<void> {
    return this.auth.verifyEmail(input.token, String(request.id));
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
    @Req() request: Pick<FastifyRequest, "id">,
  ): void {
    this.auth.forgotPassword(input.email, String(request.id));
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
    @Req() request: Pick<FastifyRequest, "id">,
  ): Promise<void> {
    return this.auth.resetPassword(input.token, input.password, String(request.id));
  }

  @Post("refresh")
  @UseGuards(OriginGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Renew the access token",
    description:
      "Swaps the refresh_token cookie for a new access token and a new cookie. Each cookie works once; using one twice signs out every copy.",
  })
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOkResponse({ type: SignInResult })
  @ApiUnauthorizedResponse({ description: "No usable refresh token: sign in again" })
  @ApiForbiddenResponse({ description: ORIGIN_REFUSED_DOC })
  async refresh(
    @Req() request: Pick<FastifyRequest, "cookies" | "id">,
    @Headers("user-agent") userAgent: string | undefined,
    @Res({ passthrough: true }) reply: Pick<FastifyReply, "setCookie">,
  ): Promise<SignInResult> {
    const session = await this.auth.refresh(
      request.cookies[REFRESH_COOKIE],
      userAgent,
      String(request.id),
    );
    return signedIn(session, reply);
  }

  @Post("sign-out")
  @UseGuards(OriginGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Sign out",
    description: "Revokes the session's refresh tokens and clears the cookie.",
  })
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: ORIGIN_REFUSED_DOC })
  async signOut(
    @Req() request: Pick<FastifyRequest, "cookies" | "id">,
    @Res({ passthrough: true }) reply: Pick<FastifyReply, "clearCookie">,
  ): Promise<void> {
    await this.auth.signOut(request.cookies[REFRESH_COOKIE], String(request.id));
    // The browser drops the cookie only when its path and flags match the ones it was set with;
    // clearCookie overrides the lifetime itself.
    reply.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
  }
}
