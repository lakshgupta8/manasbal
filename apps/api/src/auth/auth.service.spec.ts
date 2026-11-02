import { BadRequestException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import {
  AuthService,
  EMAIL_NOT_CONFIRMED,
  LINK_INVALID,
  REFRESH_FAILED,
  SIGN_IN_FAILED,
  SIGN_UP_FAILED,
} from "./auth.service.js";
import { hashToken } from "./tokens.service.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";
const HASH = "$argon2id$v=19$m=19456,t=2,p=1$stub";

const input = {
  email: "test.buyer@example.test",
  password: "a long passphrase",
  name: "Test Buyer",
  confirmAdult: true as const,
};

// A stand-in for one ORM collection: the chain methods record their filters and return the
// same object, and the terminal methods are mocks a test sets the answer of.
function fakeCollection() {
  const collection = {
    filters: [] as object[],
    where(filter: object) {
      collection.filters.push(filter);
      return collection;
    },
    select: () => collection,
    first: vi.fn<() => Promise<unknown>>(),
    create: vi.fn<(row: object) => Promise<unknown>>(),
    updateAndCount: vi.fn<(patch: object) => Promise<number>>(),
  };
  return collection;
}

let User = fakeCollection();
let RefreshToken = fakeCollection();
let EmailToken = fakeCollection();

// Sign-up and sign-in against a real database are in test/auth.e2e-spec.ts. These cover the
// service's own decisions.
vi.mock("../prisma/db.js", () => ({
  getDb: () => ({
    orm: { public: { User, RefreshToken, EmailToken } },
    transaction: (work: (tx: object) => Promise<unknown>) =>
      work({ orm: { public: { User, EmailToken } } }),
  }),
}));

describe("AuthService", () => {
  const passwords = {
    hash: vi.fn<(password: string) => Promise<string>>(),
    verify: vi.fn<(hash: string, password: string) => Promise<boolean>>(),
  };
  const tokens = {
    signAccess: vi.fn<(user: { id: string; role: string }) => Promise<string>>(),
    newRefresh: vi.fn<() => { token: string; hash: string }>(),
    newEmailToken: vi.fn<() => { token: string; hash: string }>(),
  };
  const mailer = { send: vi.fn<(mail: { to: string; text: string }) => Promise<void>>() };
  let service = new AuthService(passwords, tokens, mailer);

  beforeEach(() => {
    User = fakeCollection();
    RefreshToken = fakeCollection();
    EmailToken = fakeCollection();
    vi.unstubAllEnvs();
    passwords.hash.mockReset().mockResolvedValue(HASH);
    passwords.verify.mockReset();
    tokens.signAccess.mockReset().mockResolvedValue("access.jwt");
    tokens.newRefresh.mockReset().mockReturnValue({ token: "cookie-token", hash: "stored-hash" });
    tokens.newEmailToken.mockReset().mockReturnValue({ token: "link-token", hash: "link-hash" });
    mailer.send.mockReset().mockResolvedValue(undefined);
    // A fresh service each time, so the cached dummy hash never carries over between tests.
    service = new AuthService(passwords, tokens, mailer);
  });

  it("creates a confirmed buyer with the hash when mail is off, and sends nothing", async () => {
    const created = { id: USER_ID, email: input.email, name: input.name };
    User.first.mockResolvedValue(null);
    User.create.mockResolvedValue(created);
    const before = Temporal.Now.instant();

    await expect(service.signUp(input)).resolves.toBe(created);

    expect(passwords.hash).toHaveBeenCalledWith(input.password);
    expect(User.filters).toEqual([{ email: input.email }]);
    const row = User.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(row).toMatchObject({
      email: input.email,
      name: input.name,
      passwordHash: HASH,
      role: "buyer",
      createdByVisitor: true,
    });
    const verifiedAt = row["emailVerifiedAt"] as Temporal.Instant;
    expect(Temporal.Instant.compare(verifiedAt, before)).toBeGreaterThanOrEqual(0);
    expect(EmailToken.create).not.toHaveBeenCalled();
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it("with mail on, creates an unconfirmed buyer and mails a link stored only as its hash", async () => {
    vi.stubEnv("MAIL_MODE", "smtp");
    const created = { id: USER_ID, email: input.email, name: input.name };
    User.first.mockResolvedValue(null);
    User.create.mockResolvedValue(created);
    const before = Temporal.Now.instant();

    await expect(service.signUp(input)).resolves.toBe(created);

    expect(User.create.mock.calls[0]?.[0]).toMatchObject({ emailVerifiedAt: null });
    const token = EmailToken.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(token).toMatchObject({
      userId: USER_ID,
      purpose: "verify-email",
      tokenHash: "link-hash",
      createdByVisitor: true,
    });
    expect(JSON.stringify(token)).not.toContain("link-token");
    const hours = before.until(token["expiresAt"] as Temporal.Instant).total({ unit: "hours" });
    expect(hours).toBeCloseTo(24, 2);
    const mail = mailer.send.mock.calls[0]?.[0];
    expect(mail?.to).toBe(input.email);
    expect(mail?.text).toContain("/verify-email?token=link-token");
  });

  it("never mails a taken email", async () => {
    vi.stubEnv("MAIL_MODE", "smtp");
    User.first.mockResolvedValue({ id: USER_ID });

    await expect(service.signUp(input)).rejects.toThrow(new BadRequestException(SIGN_UP_FAILED));
    expect(EmailToken.create).not.toHaveBeenCalled();
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it("gives the generic answer for a taken email, and creates nothing", async () => {
    User.first.mockResolvedValue({ id: USER_ID });

    await expect(service.signUp(input)).rejects.toThrow(new BadRequestException(SIGN_UP_FAILED));
    expect(passwords.hash).toHaveBeenCalled();
    expect(User.create).not.toHaveBeenCalled();
  });

  it("gives the generic answer when a sign-up racing for the same email wins", async () => {
    User.first.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: USER_ID });
    User.create.mockRejectedValue(new Error("unique violation"));

    await expect(service.signUp(input)).rejects.toThrow(new BadRequestException(SIGN_UP_FAILED));
  });

  it("rethrows a create error that is not a taken email", async () => {
    const failure = new Error("connection lost");
    User.first.mockResolvedValue(null);
    User.create.mockRejectedValue(failure);

    await expect(service.signUp(input)).rejects.toBe(failure);
    expect(User.first).toHaveBeenCalledTimes(2);
  });

  describe("signIn", () => {
    const credentials = { email: input.email, password: input.password };
    const confirmedAt = Temporal.Instant.from("2026-11-01T10:00:00Z");
    const user = { id: USER_ID, role: "buyer", passwordHash: HASH, emailVerifiedAt: confirmedAt };
    const unconfirmed = { ...user, emailVerifiedAt: null };

    it("answers an access token and stores only the refresh token's hash", async () => {
      User.first.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(true);
      RefreshToken.create.mockResolvedValue({});
      const before = Temporal.Now.instant();

      await expect(service.signIn(credentials, "Test Browser")).resolves.toEqual({
        accessToken: "access.jwt",
        expiresIn: 900,
        refreshToken: "cookie-token",
      });

      expect(User.filters).toEqual([{ email: input.email }]);
      expect(passwords.verify).toHaveBeenCalledWith(HASH, input.password);
      expect(tokens.signAccess).toHaveBeenCalledWith(user);
      const row = RefreshToken.create.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(row).toMatchObject({
        userId: USER_ID,
        tokenHash: "stored-hash",
        userAgent: "Test Browser",
        createdByVisitor: true,
      });
      expect(row["familyId"]).toMatch(/^[0-9a-f-]{36}$/);
      expect(JSON.stringify(row)).not.toContain("cookie-token");
      const hours = before.until(row["expiresAt"] as Temporal.Instant).total({ unit: "hours" });
      expect(hours / 24).toBeCloseTo(14, 2);
    });

    it("refuses a wrong password with the generic answer, and stores nothing", async () => {
      User.first.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(false);

      await expect(service.signIn(credentials, undefined)).rejects.toThrow(
        new UnauthorizedException(SIGN_IN_FAILED),
      );
      expect(RefreshToken.create).not.toHaveBeenCalled();
      expect(tokens.signAccess).not.toHaveBeenCalled();
    });

    it("refuses an unconfirmed account after a right password, with mail on", async () => {
      vi.stubEnv("MAIL_MODE", "smtp");
      User.first.mockResolvedValue(unconfirmed);
      passwords.verify.mockResolvedValue(true);

      await expect(service.signIn(credentials, undefined)).rejects.toThrow(
        new ForbiddenException(EMAIL_NOT_CONFIRMED),
      );
      expect(RefreshToken.create).not.toHaveBeenCalled();
      expect(tokens.signAccess).not.toHaveBeenCalled();
    });

    it("gives an unconfirmed account the generic answer for a wrong password", async () => {
      vi.stubEnv("MAIL_MODE", "smtp");
      User.first.mockResolvedValue(unconfirmed);
      passwords.verify.mockResolvedValue(false);

      await expect(service.signIn(credentials, undefined)).rejects.toThrow(
        new UnauthorizedException(SIGN_IN_FAILED),
      );
    });

    it("lets a confirmed account in with mail on", async () => {
      vi.stubEnv("MAIL_MODE", "smtp");
      User.first.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(true);

      await expect(service.signIn(credentials, undefined)).resolves.toMatchObject({
        accessToken: "access.jwt",
      });
    });

    it("lets an unconfirmed account in with mail off, since no link could arrive", async () => {
      User.first.mockResolvedValue(unconfirmed);
      passwords.verify.mockResolvedValue(true);

      await expect(service.signIn(credentials, undefined)).resolves.toMatchObject({
        accessToken: "access.jwt",
      });
    });

    it("gives an unknown email the same answer, after checking a dummy hash", async () => {
      User.first.mockResolvedValue(null);
      passwords.hash.mockResolvedValue("dummy-hash");
      passwords.verify.mockResolvedValue(false);

      await expect(service.signIn(credentials, undefined)).rejects.toThrow(
        new UnauthorizedException(SIGN_IN_FAILED),
      );
      expect(passwords.verify).toHaveBeenCalledOnce();
      expect(passwords.verify).toHaveBeenCalledWith("dummy-hash", input.password);
    });

    it("makes the dummy hash once and reuses it", async () => {
      User.first.mockResolvedValue(null);
      passwords.verify.mockResolvedValue(false);

      await expect(service.signIn(credentials, undefined)).rejects.toThrow(UnauthorizedException);
      await expect(service.signIn(credentials, undefined)).rejects.toThrow(UnauthorizedException);
      expect(passwords.hash).toHaveBeenCalledOnce();
    });

    it("cuts the user agent to 255 characters, and stores none when there is none", async () => {
      User.first.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(true);

      await service.signIn(credentials, "x".repeat(300));
      await service.signIn(credentials, undefined);

      const agents = RefreshToken.create.mock.calls.map(
        ([row]) => (row as { userAgent?: string }).userAgent,
      );
      expect(agents).toEqual(["x".repeat(255), undefined]);
    });
  });

  describe("verifyEmail", () => {
    const LINK_ROW_ID = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e";
    const stored = (overrides: object = {}) => ({
      id: LINK_ROW_ID,
      userId: USER_ID,
      expiresAt: Temporal.Now.instant().add({ hours: 1 }),
      usedAt: null,
      ...overrides,
    });
    const refused = new BadRequestException(LINK_INVALID);

    it("marks the token used and confirms the account", async () => {
      EmailToken.first.mockResolvedValue(stored());
      EmailToken.updateAndCount.mockResolvedValue(1);
      User.updateAndCount.mockResolvedValue(1);

      await expect(service.verifyEmail("link-token")).resolves.toBeUndefined();

      expect(EmailToken.filters).toEqual([
        { tokenHash: hashToken("link-token"), purpose: "verify-email" },
        { id: LINK_ROW_ID, usedAt: null },
      ]);
      expect(User.filters).toEqual([{ id: USER_ID, emailVerifiedAt: null }]);
      const patch = EmailToken.updateAndCount.mock.calls[0]?.[0] as { usedAt: unknown };
      expect(User.updateAndCount).toHaveBeenCalledWith({ emailVerifiedAt: patch.usedAt });
    });

    it.each([
      { case: "an unknown token", row: null },
      { case: "a used token", row: stored({ usedAt: Temporal.Now.instant() }) },
      {
        case: "an expired token",
        row: stored({ expiresAt: Temporal.Now.instant().subtract({ seconds: 1 }) }),
      },
    ])("refuses $case and confirms nothing", async ({ row }) => {
      EmailToken.first.mockResolvedValue(row);

      await expect(service.verifyEmail("link-token")).rejects.toThrow(refused);
      expect(EmailToken.updateAndCount).not.toHaveBeenCalled();
      expect(User.updateAndCount).not.toHaveBeenCalled();
    });

    it("refuses the loser of two clicks racing with the same link", async () => {
      EmailToken.first.mockResolvedValue(stored());
      EmailToken.updateAndCount.mockResolvedValue(0);

      await expect(service.verifyEmail("link-token")).rejects.toThrow(refused);
      expect(User.updateAndCount).not.toHaveBeenCalled();
    });
  });

  describe("refresh", () => {
    const FAMILY_ID = "0f1e2d3c-4b5a-4968-8776-655443322110";
    const ROW_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
    const later = () => Temporal.Now.instant().add({ hours: 1 });
    const stored = (overrides: object = {}) => ({
      id: ROW_ID,
      userId: USER_ID,
      familyId: FAMILY_ID,
      expiresAt: later(),
      usedAt: null,
      revokedAt: null,
      ...overrides,
    });
    const refused = new UnauthorizedException(REFRESH_FAILED);

    it("marks the token used and issues a new pair in the same family", async () => {
      RefreshToken.first.mockResolvedValue(stored());
      RefreshToken.updateAndCount.mockResolvedValue(1);
      User.first.mockResolvedValue({ id: USER_ID, role: "buyer" });

      await expect(service.refresh("old-token", "Test Browser")).resolves.toEqual({
        accessToken: "access.jwt",
        expiresIn: 900,
        refreshToken: "cookie-token",
      });

      expect(RefreshToken.filters).toEqual([
        { tokenHash: hashToken("old-token") },
        { id: ROW_ID, usedAt: null },
      ]);
      const patch = RefreshToken.updateAndCount.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(patch["usedAt"]).toBeInstanceOf(Temporal.Instant);
      expect(RefreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          familyId: FAMILY_ID,
          tokenHash: "stored-hash",
          userAgent: "Test Browser",
        }),
      );
      expect(tokens.signAccess).toHaveBeenCalledWith({ id: USER_ID, role: "buyer" });
    });

    it("refuses a missing cookie without looking anything up", async () => {
      await expect(service.refresh(undefined, undefined)).rejects.toThrow(refused);
      expect(RefreshToken.first).not.toHaveBeenCalled();
    });

    it("refuses an unknown token", async () => {
      RefreshToken.first.mockResolvedValue(null);

      await expect(service.refresh("made-up", undefined)).rejects.toThrow(refused);
      expect(RefreshToken.updateAndCount).not.toHaveBeenCalled();
    });

    it("refuses a revoked token", async () => {
      RefreshToken.first.mockResolvedValue(stored({ revokedAt: Temporal.Now.instant() }));

      await expect(service.refresh("old-token", undefined)).rejects.toThrow(refused);
      expect(RefreshToken.updateAndCount).not.toHaveBeenCalled();
      expect(RefreshToken.create).not.toHaveBeenCalled();
    });

    it("revokes the whole family when a used token comes back", async () => {
      RefreshToken.first.mockResolvedValue(stored({ usedAt: Temporal.Now.instant() }));

      await expect(service.refresh("old-token", undefined)).rejects.toThrow(refused);
      expect(RefreshToken.filters).toContainEqual({ familyId: FAMILY_ID, revokedAt: null });
      const patch = RefreshToken.updateAndCount.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(patch["revokedAt"]).toBeInstanceOf(Temporal.Instant);
      expect(RefreshToken.create).not.toHaveBeenCalled();
    });

    it("refuses an expired token", async () => {
      RefreshToken.first.mockResolvedValue(
        stored({ expiresAt: Temporal.Now.instant().subtract({ seconds: 1 }) }),
      );

      await expect(service.refresh("old-token", undefined)).rejects.toThrow(refused);
      expect(RefreshToken.updateAndCount).not.toHaveBeenCalled();
    });

    it("treats losing a race for the same token as reuse", async () => {
      RefreshToken.first.mockResolvedValue(stored());
      // The claim finds the token already used; the revocation then updates the family.
      RefreshToken.updateAndCount.mockResolvedValueOnce(0).mockResolvedValueOnce(2);

      await expect(service.refresh("old-token", undefined)).rejects.toThrow(refused);
      expect(RefreshToken.filters).toContainEqual({ familyId: FAMILY_ID, revokedAt: null });
      expect(RefreshToken.create).not.toHaveBeenCalled();
    });

    it("refuses when the account is gone", async () => {
      RefreshToken.first.mockResolvedValue(stored());
      RefreshToken.updateAndCount.mockResolvedValue(1);
      User.first.mockResolvedValue(null);

      await expect(service.refresh("old-token", undefined)).rejects.toThrow(refused);
      expect(RefreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe("signOut", () => {
    it("revokes the family of the cookie's token", async () => {
      RefreshToken.first.mockResolvedValue({ familyId: "family-1" });

      await service.signOut("old-token");

      expect(RefreshToken.filters).toEqual([
        { tokenHash: hashToken("old-token") },
        { familyId: "family-1", revokedAt: null },
      ]);
      expect(RefreshToken.updateAndCount).toHaveBeenCalledOnce();
    });

    it("does nothing for a missing or unknown token", async () => {
      RefreshToken.first.mockResolvedValue(null);

      await service.signOut(undefined);
      await service.signOut("made-up");

      expect(RefreshToken.first).toHaveBeenCalledOnce();
      expect(RefreshToken.updateAndCount).not.toHaveBeenCalled();
    });
  });
});
