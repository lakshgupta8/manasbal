import { z } from "zod";

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
