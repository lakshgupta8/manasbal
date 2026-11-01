import { describe, expect, it } from "vitest";
import { signUpInputSchema } from "./auth.js";

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
