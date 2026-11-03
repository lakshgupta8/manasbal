import { Body, Controller, HttpCode, HttpStatus, Inject, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  RECOVERY_CODE_COUNT,
  twoStepEnableInputSchema,
  type TwoStepEnabled,
  type TwoStepEnableInput,
  type TwoStepSetup,
} from "@manasbal/types";
import { AUTH_RATE_LIMIT, RATE_WINDOW_MS } from "../rate-limit/rate-limit.module.js";
import { ApiZodBody, ZodValidationPipe } from "../validation/zod-validation.pipe.js";
import { AuthGuard } from "./auth.guard.js";
import { type Actor, CurrentActor } from "./current-user.js";
import { TwoStepService } from "./two-step.service.js";

// Classes rather than interfaces so the OpenAPI description (and the generated SDK) knows the
// shapes. They mirror twoStepSetupSchema and twoStepEnabledSchema in @manasbal/types.
export class TwoStepSetupResult {
  @ApiProperty({
    description: "Show as a QR code for the authenticator app",
    example: "otpauth://totp/Manasbal:asha%40example.test?secret=JBSWY3DPEHPK3PXP&issuer=Manasbal",
  })
  otpauthUrl: string;

  @ApiProperty({ description: "The same secret, to type in by hand", example: "JBSWY3DPEHPK3PXP" })
  secret: string;
}

export class TwoStepEnabledResult {
  @ApiProperty({
    type: [String],
    description: `${RECOVERY_CODE_COUNT} one-time codes for when the app is lost. Shown only this once.`,
    example: ["abcde-fghjk"],
  })
  recoveryCodes: string[];
}

// Switching on two-step sign-in with an authenticator app. The same tight limit as /auth/*, since
// enable checks codes.
@ApiTags("Auth")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "No valid access token" })
@Throttle({ default: { limit: AUTH_RATE_LIMIT, ttl: RATE_WINDOW_MS } })
@UseGuards(AuthGuard)
@Controller("auth/2fa")
export class TwoStepController {
  // Typed as the part it uses: a class type makes the decorator metadata emit a branch that never
  // runs. @Inject still names the provider.
  constructor(
    @Inject(TwoStepService) private readonly twoStep: Pick<TwoStepService, "setup" | "enable">,
  ) {}

  @Post("setup")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Start two-step sign-in",
    description:
      "Makes a new authenticator-app secret for the signed-in user. It is not on until POST /auth/2fa/enable gets a code from the app.",
  })
  @ApiOkResponse({ type: TwoStepSetupResult })
  @ApiConflictResponse({ description: "Two-step sign-in is already on" })
  setup(@CurrentActor() who: Actor): Promise<TwoStepSetup> {
    return this.twoStep.setup(who);
  }

  @Post("enable")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Switch on two-step sign-in",
    description:
      "Takes the 6-digit code from the authenticator app. Answers the recovery codes, which are shown only this once.",
  })
  @ApiZodBody(twoStepEnableInputSchema)
  @ApiOkResponse({ type: TwoStepEnabledResult })
  @ApiBadRequestResponse({ description: "The code is not right, or set-up was not started" })
  @ApiConflictResponse({ description: "Two-step sign-in is already on" })
  enable(
    @CurrentActor() who: Actor,
    @Body(new ZodValidationPipe(twoStepEnableInputSchema)) input: TwoStepEnableInput,
  ): Promise<TwoStepEnabled> {
    return this.twoStep.enable(who, input.code);
  }
}
