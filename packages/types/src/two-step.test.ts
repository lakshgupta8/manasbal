import { describe, expect, it } from "vitest";
import { twoStepEnabledSchema, twoStepEnableInputSchema, twoStepSetupSchema } from "./two-step.js";

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
