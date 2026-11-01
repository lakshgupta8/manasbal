import { z } from "zod";

// What a visitor types into the sign-up form. confirmAdult is checked and then dropped: it
// is never stored.
export const signUpInputSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    password: z.string().min(12, "Use at least 12 characters").max(128),
    name: z.string().trim().min(1).max(100),
    confirmAdult: z.literal(true, "Confirm you are 18 or older"),
  })
  .strict();

export type SignUpInput = z.infer<typeof signUpInputSchema>;

// Sign-in checks nothing but the format: the password rules belong to sign-up.
export const signInInputSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    password: z.string().min(1).max(128),
  })
  .strict();

export type SignInInput = z.infer<typeof signInInputSchema>;
