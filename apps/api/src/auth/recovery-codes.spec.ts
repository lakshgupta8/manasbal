import { hashRecoveryCode, newRecoveryCodes } from "./recovery-codes.js";
import { hashToken } from "./tokens.service.js";

describe("newRecoveryCodes", () => {
  it("makes 10 different codes like abcde-fghjk", () => {
    const codes = newRecoveryCodes();

    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[a-km-np-z2-9]{5}-[a-km-np-z2-9]{5}$/);
  });

  it("makes as many as asked", () => {
    expect(newRecoveryCodes(3)).toHaveLength(3);
  });
});

describe("hashRecoveryCode", () => {
  it("hashes the code with case, spaces and hyphens ignored", () => {
    expect(hashRecoveryCode("ABCDE-fghjk")).toBe(hashToken("abcdefghjk"));
    expect(hashRecoveryCode(" abcde fghjk ")).toBe(hashRecoveryCode("abcde-fghjk"));
    expect(hashRecoveryCode("abcde-fghjk")).not.toContain("abcde");
  });
});
