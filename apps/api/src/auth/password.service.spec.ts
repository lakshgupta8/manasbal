import { ARGON2_OPTIONS, PasswordService } from "./password.service.js";

describe("PasswordService", () => {
  const passwords = new PasswordService();
  const password = "correct horse battery staple";

  it("stores an argon2id hash with the OWASP minimum settings, not the password", async () => {
    const stored = await passwords.hash(password);

    expect(stored).not.toBe(password);
    expect(stored).not.toContain(password);
    expect(stored).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(ARGON2_OPTIONS.memoryCost).toBe(19 * 1024);
  });

  it("verifies the right password", async () => {
    const stored = await passwords.hash(password);

    await expect(passwords.verify(stored, password)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await passwords.hash(password);

    await expect(passwords.verify(stored, "correct horse battery stapler")).resolves.toBe(false);
  });

  it("gives two different hashes for the same password", async () => {
    const [first, second] = await Promise.all([passwords.hash(password), passwords.hash(password)]);

    expect(first).not.toBe(second);
    await expect(passwords.verify(second, password)).resolves.toBe(true);
  });
});
