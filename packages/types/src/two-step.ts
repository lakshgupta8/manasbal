import { z } from "zod";
import { signInSessionSchema } from "./auth.js";

// How many recovery codes switching on two-step sign-in gives.
export const RECOVERY_CODE_COUNT = 10;

// The 6-digit code the authenticator app shows. Spaces are allowed and dropped ("123 456").
export const twoStepEnableInputSchema = z
  .object({
    code: z
      .string()
      .transform((code) => code.replaceAll(" ", ""))
      .pipe(z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app")),
  })
  .strict();

export type TwoStepEnableInput = z.infer<typeof twoStepEnableInputSchema>;

// What set-up answers: the link an authenticator app reads (as a QR code) and the same secret to
// type in by hand.
export const twoStepSetupSchema = z.object({
  otpauthUrl: z.string().startsWith("otpauth://totp/"),
  secret: z.string().regex(/^[A-Z2-7]+=*$/),
});

export type TwoStepSetup = z.infer<typeof twoStepSetupSchema>;

// What switching on answers, once: the recovery codes. They are never shown again.
export const twoStepEnabledSchema = z.object({
  recoveryCodes: z.array(z.string()).length(RECOVERY_CODE_COUNT),
});

export type TwoStepEnabled = z.infer<typeof twoStepEnabledSchema>;

// A code at the second step of sign-in, or to switch two-step off: the 6-digit code from the
// app, or one of the recovery codes ("abcde-fghjk"). Spaces are dropped; the API tells the two
// apart.
const signInCode = z
  .string()
  .transform((code) => code.replaceAll(/\s/g, ""))
  .pipe(
    z
      .string()
      .min(6, "Enter the code from your authenticator app, or a recovery code")
      .max(20, "Enter the code from your authenticator app, or a recovery code"),
  );

// The second step of sign-in: the challenge token sign-in answered, and a code.
export const twoStepVerifyInputSchema = z
  .object({
    challengeToken: z.string().min(1).max(2000),
    code: signInCode,
  })
  .strict();

export type TwoStepVerifyInput = z.infer<typeof twoStepVerifyInputSchema>;

// Switching two-step off takes a current code, so a stolen access token alone can't do it.
export const twoStepDisableInputSchema = z
  .object({
    code: signInCode,
  })
  .strict();

export type TwoStepDisableInput = z.infer<typeof twoStepDisableInputSchema>;

// What sign-in answers when the password is right and two-step is on: no tokens yet, only a
// short-lived challenge for POST /auth/2fa/verify.
export const twoStepChallengeSchema = z.object({
  twoFactorRequired: z.literal(true),
  challengeToken: z.string().min(1),
});

export type TwoStepChallenge = z.infer<typeof twoStepChallengeSchema>;

// Everything sign-in can answer: signed in, or asked for the second step.
export const signInResultSchema = z.union([signInSessionSchema, twoStepChallengeSchema]);

export type SignInResult = z.infer<typeof signInResultSchema>;
