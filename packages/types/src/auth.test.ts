import { describe, expect, it } from "vitest";
import {
  forgotPasswordInputSchema,
  resendVerificationInputSchema,
  resetPasswordInputSchema,
  signInInputSchema,
  signUpInputSchema,
  verifyEmailInputSchema,
} from "./auth.js";

const valid = {
  email: "test.buyer@example.test",
  password: "a long passphrase",
  name: "Test Buyer",
  confirmAdult: true,
};

describe("signUpInputSchema", () => {
  it("parses a valid sign-up and lower-cases the email", () => {
    expect(signUpInputSchema.parse(valid)).toEqual(valid);
    expect(signUpInputSchema.parse({ ...valid, email: " A@Example.COM " }).email).toBe(
      "a@example.com",
    );
  });

  it("keeps spaces in the password", () => {
    const password = "  spaced out phrase  ";

    expect(signUpInputSchema.parse({ ...valid, password }).password).toBe(password);
  });

  it.each([
    { length: 11, ok: false },
    { length: 12, ok: true },
    { length: 128, ok: true },
    { length: 129, ok: false },
  ])("a $length-character password parses: $ok", ({ length, ok }) => {
    const result = signUpInputSchema.safeParse({ ...valid, password: "x".repeat(length) });

    expect(result.success).toBe(ok);
  });

  it("says why a short password fails", () => {
    const result = signUpInputSchema.safeParse({ ...valid, password: "x".repeat(11) });

    expect(result.error?.issues[0]?.message).toBe("Use at least 12 characters");
  });

  it.each([
    { case: "missing", input: { ...valid, confirmAdult: undefined } },
    { case: "false", input: { ...valid, confirmAdult: false } },
  ])("fails when confirmAdult is $case", ({ input }) => {
    const result = signUpInputSchema.safeParse(input);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Confirm you are 18 or older");
  });

  it("fails on an unknown field such as role", () => {
    expect(signUpInputSchema.safeParse({ ...valid, role: "admin" }).success).toBe(false);
  });

  it("fails on an email that is not an email, or a blank name", () => {
    expect(signUpInputSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(signUpInputSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
  });
});

describe("signInInputSchema", () => {
  const credentials = { email: "test.buyer@example.test", password: "x" };

  it("parses an email and any non-empty password, lower-casing the email", () => {
    expect(signInInputSchema.parse(credentials)).toEqual(credentials);
    expect(signInInputSchema.parse({ ...credentials, email: " A@Example.COM " }).email).toBe(
      "a@example.com",
    );
  });

  it("does not apply the sign-up password rules, but keeps the upper limit", () => {
    expect(signInInputSchema.safeParse({ ...credentials, password: "short" }).success).toBe(true);
    expect(signInInputSchema.safeParse({ ...credentials, password: "" }).success).toBe(false);
    expect(signInInputSchema.safeParse({ ...credentials, password: "x".repeat(129) }).success).toBe(
      false,
    );
  });

  it("fails on a malformed email or an unknown field", () => {
    expect(signInInputSchema.safeParse({ ...credentials, email: "nope" }).success).toBe(false);
    expect(signInInputSchema.safeParse({ ...credentials, remember: true }).success).toBe(false);
  });
});

describe("verifyEmailInputSchema", () => {
  it("parses a token and trims it", () => {
    expect(verifyEmailInputSchema.parse({ token: " abc_DEF-123 " })).toEqual({
      token: "abc_DEF-123",
    });
  });

  it.each([{}, { token: "" }, { token: "x".repeat(101) }, { token: "t", extra: true }])(
    "refuses %j",
    (input) => {
      expect(verifyEmailInputSchema.safeParse(input).success).toBe(false);
    },
  );
});

describe("forgotPasswordInputSchema", () => {
  it("normalises the email like sign-in", () => {
    expect(forgotPasswordInputSchema.parse({ email: " A@Example.COM " })).toEqual({
      email: "a@example.com",
    });
  });

  it("refuses a malformed email or an unknown field", () => {
    expect(forgotPasswordInputSchema.safeParse({ email: "nope" }).success).toBe(false);
    expect(forgotPasswordInputSchema.safeParse({ email: "a@example.com", x: 1 }).success).toBe(
      false,
    );
  });
});

describe("resetPasswordInputSchema", () => {
  const token = "abc_DEF-123";

  it("parses a token and a new password", () => {
    expect(resetPasswordInputSchema.parse({ token, password: "a long passphrase" })).toEqual({
      token,
      password: "a long passphrase",
    });
  });

  it("applies the sign-up password rule", () => {
    const short = resetPasswordInputSchema.safeParse({ token, password: "x".repeat(11) });

    expect(short.success).toBe(false);
    expect(short.error?.issues[0]?.message).toBe("Use at least 12 characters");
    expect(resetPasswordInputSchema.safeParse({ token, password: "x".repeat(129) }).success).toBe(
      false,
    );
  });

  it("refuses a missing token", () => {
    expect(resetPasswordInputSchema.safeParse({ password: "a long passphrase" }).success).toBe(
      false,
    );
  });
});

describe("resendVerificationInputSchema", () => {
  it("normalises the email like sign-in", () => {
    expect(resendVerificationInputSchema.parse({ email: " A@Example.COM " })).toEqual({
      email: "a@example.com",
    });
  });

  it("refuses a non-email and anything extra", () => {
    expect(resendVerificationInputSchema.safeParse({ email: "nope" }).success).toBe(false);
    expect(resendVerificationInputSchema.safeParse({ email: "a@example.com", x: 1 }).success).toBe(
      false,
    );
  });
});
