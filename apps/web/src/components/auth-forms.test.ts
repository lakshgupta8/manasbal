import { describe, expect, it } from "vitest";
import {
  ForgotPasswordForm,
  ResetPasswordForm,
  SignInForm,
  SignUpForm,
  VerifyEmail,
} from "./auth-forms";
import { ForgotPasswordForm as forgot } from "./forgot-password-form";
import { ResetPasswordForm as reset } from "./reset-password-form";
import { SignInForm as signIn } from "./sign-in-form";
import { SignUpForm as signUp } from "./sign-up-form";
import { VerifyEmail as verify } from "./verify-email";

describe("auth-forms", () => {
  it("is the sign-in forms, as one module the pages share", () => {
    expect([SignInForm, SignUpForm, VerifyEmail, ForgotPasswordForm, ResetPasswordForm]).toEqual([
      signIn,
      signUp,
      verify,
      forgot,
      reset,
    ]);
  });
});
