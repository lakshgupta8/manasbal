import { describe, expect, it } from "vitest";
import {
  signInResultSchema,
  twoStepDisableInputSchema,
  twoStepEnabledSchema,
  twoStepEnableInputSchema,
  twoStepSetupSchema,
  twoStepVerifyInputSchema,
} from "./two-step.js";

describe("twoStepEnableInputSchema", () => {
  it("takes a 6-digit code, with spaces dropped", () => {
    expect(twoStepEnableInputSchema.parse({ code: "123 456" })).toEqual({ code: "123456" });
  });

  it.each([
    { code: "12345" },
    { code: "1234567" },
    { code: "12345a" },
    {},
    { code: "123456", x: 1 },
  ])("refuses %j", (input) => {
    expect(twoStepEnableInputSchema.safeParse(input).success).toBe(false);
  });
});

describe("twoStepSetupSchema and twoStepEnabledSchema", () => {
  it("describe the answers", () => {
    expect(
      twoStepSetupSchema.safeParse({
        otpauthUrl: "otpauth://totp/Manasbal:a%40example.test?secret=JBSWY3DP&issuer=Manasbal",
        secret: "JBSWY3DP",
      }).success,
    ).toBe(true);
    expect(
      twoStepEnabledSchema.safeParse({ recoveryCodes: Array(10).fill("abcde-fghjk") }).success,
    ).toBe(true);
    expect(twoStepEnabledSchema.safeParse({ recoveryCodes: ["one"] }).success).toBe(false);
  });
});

describe("twoStepVerifyInputSchema and twoStepDisableInputSchema", () => {
  it("take a 6-digit code or a recovery code, with spaces dropped", () => {
    expect(twoStepVerifyInputSchema.parse({ challengeToken: "a.b.c", code: "123 456" })).toEqual({
      challengeToken: "a.b.c",
      code: "123456",
    });
    expect(twoStepDisableInputSchema.parse({ code: " abcde-fghjk " })).toEqual({
      code: "abcde-fghjk",
    });
  });

  it.each([
    { challengeToken: "a.b.c", code: "12345" },
    { challengeToken: "a.b.c", code: "x".repeat(21) },
    { challengeToken: "", code: "123456" },
    { code: "123456" },
    { challengeToken: "a.b.c", code: "123456", x: 1 },
  ])("refuses %j", (input) => {
    expect(twoStepVerifyInputSchema.safeParse(input).success).toBe(false);
  });
});

describe("signInResultSchema", () => {
  it("is either a session or a two-step challenge", () => {
    expect(signInResultSchema.safeParse({ accessToken: "a.b.c", expiresIn: 900 }).success).toBe(
      true,
    );
    expect(
      signInResultSchema.safeParse({ twoFactorRequired: true, challengeToken: "a.b.c" }).success,
    ).toBe(true);
    expect(signInResultSchema.safeParse({ twoFactorRequired: false }).success).toBe(false);
  });
});
