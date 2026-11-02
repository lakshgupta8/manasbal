import { z } from "zod";

// The rules shared by more than one form.
const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const newPassword = z.string().min(12, "Use at least 12 characters").max(128);
// A token from a link in a mail: 32 random bytes as base64url (43 characters).
const linkToken = z.string().trim().min(1).max(100);

// What a visitor types into the sign-up form. confirmAdult is checked and then dropped: it
// is never stored.
export const signUpInputSchema = z
  .object({
    email,
    password: newPassword,
    name: z.string().trim().min(1).max(100),
    confirmAdult: z.literal(true, "Confirm you are 18 or older"),
  })
  .strict();

export type SignUpInput = z.infer<typeof signUpInputSchema>;

// Sign-in checks nothing but the format: the password rules belong to sign-up.
export const signInInputSchema = z
  .object({
    email,
    password: z.string().min(1).max(128),
  })
  .strict();

export type SignInInput = z.infer<typeof signInInputSchema>;

// The token from the link in the confirmation mail.
export const verifyEmailInputSchema = z
  .object({
    token: linkToken,
  })
  .strict();

export type VerifyEmailInput = z.infer<typeof verifyEmailInputSchema>;

// Asks for a reset link. Normalised like sign-in, so the same account is found.
export const forgotPasswordInputSchema = z
  .object({
    email,
  })
  .strict();

export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>;

// The token from the reset link and the new password, which follows the sign-up rules.
export const resetPasswordInputSchema = z
  .object({
    token: linkToken,
    password: newPassword,
  })
  .strict();

export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;
