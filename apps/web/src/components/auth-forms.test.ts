import { describe, expect, it } from "vitest";
import { SignInForm, SignUpForm, VerifyEmail } from "./auth-forms";
import { SignInForm as signIn } from "./sign-in-form";
import { SignUpForm as signUp } from "./sign-up-form";
import { VerifyEmail as verify } from "./verify-email";

describe("auth-forms", () => {
  it("is the three forms, as one module the pages share", () => {
    expect([SignInForm, SignUpForm, VerifyEmail]).toEqual([signIn, signUp, verify]);
  });
});
