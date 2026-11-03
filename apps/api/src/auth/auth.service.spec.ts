import {
  BadRequestException,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import {
  AuthService,
  EMAIL_NOT_CONFIRMED,
  LINK_INVALID,
  REFRESH_FAILED,
  RESET_MAIL_FAILED,
  SIGN_IN_FAILED,
  SIGN_UP_FAILED,
} from "./auth.service.js";
import { TooManyTriesException } from "../errors/too-many-tries.exception.js";
import { emailLockKey, userLockKey } from "./lockout.service.js";
import { hashToken } from "./tokens.service.js";
import { SIGN_IN_AGAIN, WRONG_CODE } from "./two-step.service.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";
const REQ = "req-1";
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
      work({ orm: { public: { User, RefreshToken, EmailToken } } }),
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
    signChallenge: vi.fn<(userId: string) => Promise<string>>(),
    verifyChallenge: vi.fn<(token: string) => Promise<string>>(),
  };
  const twoStep = {
    verifySignIn:
      vi.fn<
        (
          who: { userId: string; requestId: string },
          code: string,
        ) => Promise<{ id: string; role: string }>
      >(),
  };
  const mailer = { send: vi.fn<(mail: { to: string; text: string }) => Promise<void>>() };
  const lockout = {
    assertOpen: vi.fn<(key: string) => Promise<void>>(),
    fail: vi.fn<(key: string) => Promise<boolean>>(),
    clear: vi.fn<(key: string) => Promise<void>>(),
  };
  const audit = {
    record:
      vi.fn<
        (
          who: { userId: string | null; requestId: string },
          action: string,
          target: { type: string; id: string } | null,
          orm?: unknown,
        ) => Promise<void>
      >(),
  };
  const create = () => new AuthService(passwords, tokens, mailer, twoStep, lockout, audit);
  let service = create();
  // The actions recorded, in order, and every recorded argument as one string to search.
  const recorded = () => audit.record.mock.calls.map((call) => call[1]);
  const everything = () => JSON.stringify(audit.record.mock.calls.map((call) => call.slice(0, 3)));
  const ACCOUNT = { type: "user", id: USER_ID };

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
    tokens.signChallenge.mockReset().mockResolvedValue("challenge.jwt");
    tokens.verifyChallenge.mockReset();
    twoStep.verifySignIn.mockReset();
    // A fresh service each time, so the cached dummy hash never carries over between tests.
    lockout.assertOpen.mockReset().mockResolvedValue(undefined);
    lockout.fail.mockReset().mockResolvedValue(false);
    lockout.clear.mockReset().mockResolvedValue(undefined);
    audit.record.mockReset().mockResolvedValue(undefined);
    service = create();
  });

  it("creates a confirmed customer with the hash when mail is off, and sends nothing", async () => {
    const created = { id: USER_ID, email: input.email, name: input.name };
    User.first.mockResolvedValue(null);
    User.create.mockResolvedValue(created);
    const before = Temporal.Now.instant();

    await expect(service.signUp(input, REQ)).resolves.toBe(created);

    expect(passwords.hash).toHaveBeenCalledWith(input.password);
    expect(User.filters).toEqual([{ email: input.email }]);
    const row = User.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(row).toMatchObject({
      email: input.email,
      name: input.name,
      passwordHash: HASH,
      role: "customer",
      createdByVisitor: true,
    });
    const verifiedAt = row["emailVerifiedAt"] as Temporal.Instant;
    expect(Temporal.Instant.compare(verifiedAt, before)).toBeGreaterThanOrEqual(0);
    expect(EmailToken.create).not.toHaveBeenCalled();
    expect(mailer.send).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      { userId: USER_ID, requestId: REQ },
      "auth.sign_up",
      ACCOUNT,
    );
    expect(everything()).not.toContain(input.email);
  });

  it("with mail on, creates an unconfirmed customer and mails a link stored only as its hash", async () => {
    vi.stubEnv("MAIL_MODE", "smtp");
    const created = { id: USER_ID, email: input.email, name: input.name };
    User.first.mockResolvedValue(null);
    User.create.mockResolvedValue(created);
    const before = Temporal.Now.instant();

    await expect(service.signUp(input, REQ)).resolves.toBe(created);

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

    await expect(service.signUp(input, REQ)).rejects.toThrow(
      new BadRequestException(SIGN_UP_FAILED),
    );
    expect(EmailToken.create).not.toHaveBeenCalled();
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it("gives the generic answer for a taken email, and creates nothing", async () => {
    User.first.mockResolvedValue({ id: USER_ID });

    await expect(service.signUp(input, REQ)).rejects.toThrow(
      new BadRequestException(SIGN_UP_FAILED),
    );
    expect(passwords.hash).toHaveBeenCalled();
    expect(User.create).not.toHaveBeenCalled();
  });

  it("gives the generic answer when a sign-up racing for the same email wins", async () => {
    User.first.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: USER_ID });
    User.create.mockRejectedValue(new Error("unique violation"));

    await expect(service.signUp(input, REQ)).rejects.toThrow(
      new BadRequestException(SIGN_UP_FAILED),
    );
  });

  it("rethrows a create error that is not a taken email", async () => {
    const failure = new Error("connection lost");
    User.first.mockResolvedValue(null);
    User.create.mockRejectedValue(failure);

    await expect(service.signUp(input, REQ)).rejects.toBe(failure);
    expect(User.first).toHaveBeenCalledTimes(2);
  });

  describe("signIn", () => {
    const credentials = { email: input.email, password: input.password };
    const confirmedAt = Temporal.Instant.from("2026-11-01T10:00:00Z");
    const user = {
      id: USER_ID,
      role: "customer",
      passwordHash: HASH,
      emailVerifiedAt: confirmedAt,
      totpEnabledAt: null,
    };
    const unconfirmed = { ...user, emailVerifiedAt: null };

    it("answers an access token and stores only the refresh token's hash", async () => {
      User.first.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(true);
      RefreshToken.create.mockResolvedValue({});
      const before = Temporal.Now.instant();

      await expect(service.signIn(credentials, "Test Browser", REQ)).resolves.toEqual({
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

    it("records the sign-in and clears the email's failures, with no email in the record", async () => {
      User.first.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(true);
      RefreshToken.create.mockResolvedValue({});

      await service.signIn(credentials, undefined, REQ);

      expect(lockout.assertOpen).toHaveBeenCalledWith(emailLockKey(input.email));
      expect(lockout.clear).toHaveBeenCalledWith(emailLockKey(input.email));
      expect(lockout.fail).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        { userId: USER_ID, requestId: REQ },
        "auth.sign_in",
        ACCOUNT,
      );
      expect(everything()).not.toContain(input.email);
      expect(everything()).not.toContain(input.password);
    });

    it("answers 429 for a locked email before checking the password, even a right one", async () => {
      lockout.assertOpen.mockRejectedValue(new TooManyTriesException("locked", 900));

      await expect(service.signIn(credentials, undefined, REQ)).rejects.toThrow(
        TooManyTriesException,
      );
      expect(User.first).not.toHaveBeenCalled();
      expect(passwords.verify).not.toHaveBeenCalled();
      expect(RefreshToken.create).not.toHaveBeenCalled();
    });

    it("counts and records a wrong password against the account", async () => {
      User.first.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(false);

      await expect(service.signIn(credentials, undefined, REQ)).rejects.toThrow(
        new UnauthorizedException(SIGN_IN_FAILED),
      );
      expect(lockout.fail).toHaveBeenCalledWith(emailLockKey(input.email));
      expect(lockout.clear).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        { userId: USER_ID, requestId: REQ },
        "auth.sign_in.failed",
        ACCOUNT,
      );
      expect(recorded()).toEqual(["auth.sign_in.failed"]);
    });

    it("counts an unknown email the same way, recorded with no actor, no target and no email", async () => {
      User.first.mockResolvedValue(null);
      passwords.verify.mockResolvedValue(false);

      await expect(service.signIn(credentials, undefined, REQ)).rejects.toThrow(
        new UnauthorizedException(SIGN_IN_FAILED),
      );
      expect(lockout.fail).toHaveBeenCalledWith(emailLockKey(input.email));
      expect(audit.record).toHaveBeenCalledWith(
        { userId: null, requestId: REQ },
        "auth.sign_in.failed",
        null,
      );
      expect(everything()).not.toContain(input.email);
    });

    it("records the lockout when the fifth failure locks the email", async () => {
      User.first.mockResolvedValue(null);
      passwords.verify.mockResolvedValue(false);
      lockout.fail.mockResolvedValue(true);

      await expect(service.signIn(credentials, undefined, REQ)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(recorded()).toEqual(["auth.sign_in.failed", "auth.lockout"]);
      expect(audit.record).toHaveBeenLastCalledWith(
        { userId: null, requestId: REQ },
        "auth.lockout",
        null,
      );
    });

    it("answers only a challenge when two-step is on: no tokens, nothing stored", async () => {
      User.first.mockResolvedValue({ ...user, totpEnabledAt: confirmedAt });
      passwords.verify.mockResolvedValue(true);

      await expect(service.signIn(credentials, "Test Browser", REQ)).resolves.toEqual({
        twoFactorRequired: true,
        challengeToken: "challenge.jwt",
      });

      expect(tokens.signChallenge).toHaveBeenCalledWith(USER_ID);
      expect(recorded()).toEqual(["auth.2fa.challenge"]);
      expect(tokens.signAccess).not.toHaveBeenCalled();
      expect(tokens.newRefresh).not.toHaveBeenCalled();
      expect(RefreshToken.create).not.toHaveBeenCalled();
    });

    it("gives a two-step account the generic answer for a wrong password, and no challenge", async () => {
      User.first.mockResolvedValue({ ...user, totpEnabledAt: confirmedAt });
      passwords.verify.mockResolvedValue(false);

      await expect(service.signIn(credentials, undefined, REQ)).rejects.toThrow(
        new UnauthorizedException(SIGN_IN_FAILED),
      );
      expect(tokens.signChallenge).not.toHaveBeenCalled();
    });

    it("refuses a wrong password with the generic answer, and stores nothing", async () => {
      User.first.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(false);

      await expect(service.signIn(credentials, undefined, REQ)).rejects.toThrow(
        new UnauthorizedException(SIGN_IN_FAILED),
      );
      expect(RefreshToken.create).not.toHaveBeenCalled();
      expect(tokens.signAccess).not.toHaveBeenCalled();
    });

    it("refuses an unconfirmed account after a right password, with mail on", async () => {
      vi.stubEnv("MAIL_MODE", "smtp");
      User.first.mockResolvedValue(unconfirmed);
      passwords.verify.mockResolvedValue(true);

      await expect(service.signIn(credentials, undefined, REQ)).rejects.toThrow(
        new ForbiddenException(EMAIL_NOT_CONFIRMED),
      );
      expect(RefreshToken.create).not.toHaveBeenCalled();
      expect(tokens.signAccess).not.toHaveBeenCalled();
    });

    it("gives an unconfirmed account the generic answer for a wrong password", async () => {
      vi.stubEnv("MAIL_MODE", "smtp");
      User.first.mockResolvedValue(unconfirmed);
      passwords.verify.mockResolvedValue(false);

      await expect(service.signIn(credentials, undefined, REQ)).rejects.toThrow(
        new UnauthorizedException(SIGN_IN_FAILED),
      );
    });

    it("lets a confirmed account in with mail on", async () => {
      vi.stubEnv("MAIL_MODE", "smtp");
      User.first.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(true);

      await expect(service.signIn(credentials, undefined, REQ)).resolves.toMatchObject({
        accessToken: "access.jwt",
      });
    });

    it("lets an unconfirmed account in with mail off, since no link could arrive", async () => {
      User.first.mockResolvedValue(unconfirmed);
      passwords.verify.mockResolvedValue(true);

      await expect(service.signIn(credentials, undefined, REQ)).resolves.toMatchObject({
        accessToken: "access.jwt",
      });
    });

    it("gives an unknown email the same answer, after checking a dummy hash", async () => {
      User.first.mockResolvedValue(null);
      passwords.hash.mockResolvedValue("dummy-hash");
      passwords.verify.mockResolvedValue(false);

      await expect(service.signIn(credentials, undefined, REQ)).rejects.toThrow(
        new UnauthorizedException(SIGN_IN_FAILED),
      );
      expect(passwords.verify).toHaveBeenCalledOnce();
      expect(passwords.verify).toHaveBeenCalledWith("dummy-hash", input.password);
    });

    it("makes the dummy hash once and reuses it", async () => {
      User.first.mockResolvedValue(null);
      passwords.verify.mockResolvedValue(false);

      await expect(service.signIn(credentials, undefined, REQ)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.signIn(credentials, undefined, REQ)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(passwords.hash).toHaveBeenCalledOnce();
    });

    it("cuts the user agent to 255 characters, and stores none when there is none", async () => {
      User.first.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(true);

      await service.signIn(credentials, "x".repeat(300), REQ);
      await service.signIn(credentials, undefined, REQ);

      const agents = RefreshToken.create.mock.calls.map(
        ([row]) => (row as { userAgent?: string }).userAgent,
      );
      expect(agents).toEqual(["x".repeat(255), undefined]);
    });
  });

  describe("verifyTwoStep", () => {
    const input = { challengeToken: "challenge.jwt", code: "123456" };

    it("signs in the challenge's user with a new session, as sign-in does", async () => {
      tokens.verifyChallenge.mockResolvedValue(USER_ID);
      twoStep.verifySignIn.mockResolvedValue({ id: USER_ID, role: "customer" });
      RefreshToken.create.mockResolvedValue({});

      await expect(service.verifyTwoStep(input, "Test Browser", "req-1")).resolves.toEqual({
        accessToken: "access.jwt",
        expiresIn: 900,
        refreshToken: "cookie-token",
      });

      expect(tokens.verifyChallenge).toHaveBeenCalledWith("challenge.jwt");
      expect(twoStep.verifySignIn).toHaveBeenCalledWith(
        { userId: USER_ID, requestId: "req-1" },
        "123456",
      );
      expect(tokens.signAccess).toHaveBeenCalledWith({ id: USER_ID, role: "customer" });
      expect(lockout.assertOpen).toHaveBeenCalledWith(userLockKey(USER_ID));
      expect(lockout.clear).toHaveBeenCalledWith(userLockKey(USER_ID));
      expect(RefreshToken.create.mock.calls[0]?.[0]).toMatchObject({
        userId: USER_ID,
        tokenHash: "stored-hash",
        userAgent: "Test Browser",
      });
    });

    it("answers 401 for an expired, forged or wrong-purpose challenge, and checks no code", async () => {
      tokens.verifyChallenge.mockRejectedValue(new Error("Not a two-step challenge"));

      await expect(service.verifyTwoStep(input, undefined, "req-1")).rejects.toThrow(
        new UnauthorizedException(SIGN_IN_AGAIN),
      );
      expect(twoStep.verifySignIn).not.toHaveBeenCalled();
      expect(RefreshToken.create).not.toHaveBeenCalled();
    });

    it("issues nothing when the code is wrong, and counts it against the account", async () => {
      tokens.verifyChallenge.mockResolvedValue(USER_ID);
      twoStep.verifySignIn.mockRejectedValue(new UnauthorizedException(WRONG_CODE));
      lockout.fail.mockResolvedValue(true);

      await expect(service.verifyTwoStep(input, undefined, "req-1")).rejects.toThrow(
        new UnauthorizedException(WRONG_CODE),
      );
      expect(tokens.signAccess).not.toHaveBeenCalled();
      expect(RefreshToken.create).not.toHaveBeenCalled();
      expect(lockout.fail).toHaveBeenCalledWith(userLockKey(USER_ID));
      expect(lockout.clear).not.toHaveBeenCalled();
      expect(recorded()).toEqual(["auth.2fa.failed", "auth.lockout"]);
      expect(audit.record).toHaveBeenCalledWith(
        { userId: USER_ID, requestId: "req-1" },
        "auth.2fa.failed",
        ACCOUNT,
      );
    });

    it("answers 429 once the account's codes are locked, without checking the code", async () => {
      tokens.verifyChallenge.mockResolvedValue(USER_ID);
      lockout.assertOpen.mockRejectedValue(new TooManyTriesException("locked", 900));

      await expect(service.verifyTwoStep(input, undefined, "req-1")).rejects.toThrow(
        TooManyTriesException,
      );
      expect(twoStep.verifySignIn).not.toHaveBeenCalled();
    });

    it("counts nothing when the code was not the problem", async () => {
      tokens.verifyChallenge.mockResolvedValue(USER_ID);
      for (const error of [new UnauthorizedException(SIGN_IN_AGAIN), new Error("database down")]) {
        twoStep.verifySignIn.mockRejectedValueOnce(error);

        await expect(service.verifyTwoStep(input, undefined, "req-1")).rejects.toThrow(error);
      }
      expect(lockout.fail).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
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

      await expect(service.verifyEmail("link-token", REQ)).resolves.toBeUndefined();

      expect(EmailToken.filters).toEqual([
        { tokenHash: hashToken("link-token"), purpose: "verify-email" },
        { id: LINK_ROW_ID, usedAt: null },
      ]);
      expect(User.filters).toEqual([{ id: USER_ID, emailVerifiedAt: null }]);
      const patch = EmailToken.updateAndCount.mock.calls[0]?.[0] as { usedAt: unknown };
      expect(User.updateAndCount).toHaveBeenCalledWith({ emailVerifiedAt: patch.usedAt });
      expect(audit.record).toHaveBeenCalledWith(
        { userId: USER_ID, requestId: REQ },
        "auth.email.verify",
        ACCOUNT,
        expect.anything(),
      );
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

      await expect(service.verifyEmail("link-token", REQ)).rejects.toThrow(refused);
      expect(EmailToken.updateAndCount).not.toHaveBeenCalled();
      expect(User.updateAndCount).not.toHaveBeenCalled();
    });

    it("refuses the loser of two clicks racing with the same link", async () => {
      EmailToken.first.mockResolvedValue(stored());
      EmailToken.updateAndCount.mockResolvedValue(0);

      await expect(service.verifyEmail("link-token", REQ)).rejects.toThrow(refused);
      expect(User.updateAndCount).not.toHaveBeenCalled();
    });
  });

  describe("forgotPassword", () => {
    const logged = () => vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("stores a 1-hour reset token as its hash and mails the link", async () => {
      User.first.mockResolvedValue({ id: USER_ID, email: input.email });
      const before = Temporal.Now.instant();

      expect(service.forgotPassword(input.email, REQ)).toBeUndefined();

      await vi.waitFor(() => expect(mailer.send).toHaveBeenCalled());
      expect(User.filters).toEqual([{ email: input.email }]);
      const row = EmailToken.create.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(row).toMatchObject({
        userId: USER_ID,
        purpose: "reset-password",
        tokenHash: "link-hash",
        createdByVisitor: true,
      });
      expect(JSON.stringify(row)).not.toContain("link-token");
      const hours = before.until(row["expiresAt"] as Temporal.Instant).total({ unit: "hours" });
      expect(hours).toBeCloseTo(1, 2);
      const mail = mailer.send.mock.calls[0]?.[0];
      expect(mail?.to).toBe(input.email);
      expect(mail?.text).toContain("/reset-password?token=link-token");
      expect(audit.record).toHaveBeenCalledWith(
        { userId: USER_ID, requestId: REQ },
        "auth.password_reset.request",
        ACCOUNT,
      );
      expect(everything()).not.toContain(input.email);
    });

    it("stores and sends nothing for an unknown email", async () => {
      User.first.mockResolvedValue(null);

      expect(service.forgotPassword("nobody@example.test", REQ)).toBeUndefined();

      await vi.waitFor(() => expect(User.first).toHaveBeenCalled());
      await Promise.resolve();
      expect(EmailToken.create).not.toHaveBeenCalled();
      expect(mailer.send).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it("logs a failed send without the address or the token", async () => {
      const error = logged();
      User.first.mockResolvedValue({ id: USER_ID, email: input.email });
      mailer.send.mockRejectedValue(new TypeError(`could not reach ${input.email}`));

      expect(service.forgotPassword(input.email, REQ)).toBeUndefined();

      await vi.waitFor(() => expect(error).toHaveBeenCalled());
      expect(error).toHaveBeenCalledWith(`${RESET_MAIL_FAILED} (TypeError)`);
      expect(JSON.stringify(error.mock.calls)).not.toContain(input.email);
      expect(JSON.stringify(error.mock.calls)).not.toContain("link-token");
    });

    it("logs a failure that is not an Error too", async () => {
      const error = logged();
      User.first.mockRejectedValue("connection lost");

      service.forgotPassword(input.email, REQ);

      await vi.waitFor(() =>
        expect(error).toHaveBeenCalledWith(`${RESET_MAIL_FAILED} (unknown error)`),
      );
    });
  });

  describe("resetPassword", () => {
    const LINK_ROW_ID = "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f";
    const stored = (overrides: object = {}) => ({
      id: LINK_ROW_ID,
      userId: USER_ID,
      expiresAt: Temporal.Now.instant().add({ minutes: 30 }),
      usedAt: null,
      ...overrides,
    });
    const refused = new BadRequestException(LINK_INVALID);

    it("sets the new hash, uses the link up, confirms the address and ends every session", async () => {
      passwords.hash.mockResolvedValue("new-hash");
      EmailToken.first.mockResolvedValue(stored());
      EmailToken.updateAndCount.mockResolvedValue(1);

      await expect(
        service.resetPassword("link-token", "a new long passphrase", REQ),
      ).resolves.toBeUndefined();

      expect(passwords.hash).toHaveBeenCalledWith("a new long passphrase");
      expect(EmailToken.filters).toEqual([
        { tokenHash: hashToken("link-token"), purpose: "reset-password" },
        { id: LINK_ROW_ID, usedAt: null },
        { userId: USER_ID, purpose: "reset-password", usedAt: null },
      ]);
      const usedAt = (EmailToken.updateAndCount.mock.calls[0]?.[0] as { usedAt: unknown }).usedAt;
      expect(User.filters).toEqual([{ id: USER_ID }, { id: USER_ID, emailVerifiedAt: null }]);
      expect(User.updateAndCount.mock.calls).toEqual([
        [{ passwordHash: "new-hash" }],
        [{ emailVerifiedAt: usedAt }],
      ]);
      expect(RefreshToken.filters).toEqual([{ userId: USER_ID, revokedAt: null }]);
      expect(RefreshToken.updateAndCount).toHaveBeenCalledWith({ revokedAt: usedAt });
      expect(EmailToken.updateAndCount).toHaveBeenLastCalledWith({ usedAt });
      expect(audit.record).toHaveBeenCalledWith(
        { userId: USER_ID, requestId: REQ },
        "auth.password_reset.complete",
        ACCOUNT,
        expect.anything(),
      );
      expect(everything()).not.toContain("a new long passphrase");
    });

    it.each([
      { case: "an unknown token", row: null },
      { case: "a used token", row: stored({ usedAt: Temporal.Now.instant() }) },
      {
        case: "an expired token",
        row: stored({ expiresAt: Temporal.Now.instant().subtract({ seconds: 1 }) }),
      },
    ])("refuses $case and changes nothing", async ({ row }) => {
      EmailToken.first.mockResolvedValue(row);

      await expect(
        service.resetPassword("link-token", "a new long passphrase", REQ),
      ).rejects.toThrow(refused);
      expect(EmailToken.updateAndCount).not.toHaveBeenCalled();
      expect(User.updateAndCount).not.toHaveBeenCalled();
      expect(RefreshToken.updateAndCount).not.toHaveBeenCalled();
    });

    it("refuses the loser of two uses racing with the same link", async () => {
      EmailToken.first.mockResolvedValue(stored());
      EmailToken.updateAndCount.mockResolvedValue(0);

      await expect(
        service.resetPassword("link-token", "a new long passphrase", REQ),
      ).rejects.toThrow(refused);
      expect(User.updateAndCount).not.toHaveBeenCalled();
      expect(RefreshToken.updateAndCount).not.toHaveBeenCalled();
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
      User.first.mockResolvedValue({ id: USER_ID, role: "customer" });

      await expect(service.refresh("old-token", "Test Browser", REQ)).resolves.toEqual({
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
      expect(tokens.signAccess).toHaveBeenCalledWith({ id: USER_ID, role: "customer" });
    });

    it("refuses a missing cookie without looking anything up", async () => {
      await expect(service.refresh(undefined, undefined, REQ)).rejects.toThrow(refused);
      expect(RefreshToken.first).not.toHaveBeenCalled();
    });

    it("refuses an unknown token", async () => {
      RefreshToken.first.mockResolvedValue(null);

      await expect(service.refresh("made-up", undefined, REQ)).rejects.toThrow(refused);
      expect(RefreshToken.updateAndCount).not.toHaveBeenCalled();
    });

    it("refuses a revoked token", async () => {
      RefreshToken.first.mockResolvedValue(stored({ revokedAt: Temporal.Now.instant() }));

      await expect(service.refresh("old-token", undefined, REQ)).rejects.toThrow(refused);
      expect(RefreshToken.updateAndCount).not.toHaveBeenCalled();
      expect(RefreshToken.create).not.toHaveBeenCalled();
    });

    it("revokes the whole family when a used token comes back", async () => {
      RefreshToken.first.mockResolvedValue(stored({ usedAt: Temporal.Now.instant() }));

      await expect(service.refresh("old-token", undefined, REQ)).rejects.toThrow(refused);
      expect(audit.record).toHaveBeenCalledWith(
        { userId: USER_ID, requestId: REQ },
        "auth.refresh.reuse",
        ACCOUNT,
      );
      expect(RefreshToken.filters).toContainEqual({ familyId: FAMILY_ID, revokedAt: null });
      const patch = RefreshToken.updateAndCount.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(patch["revokedAt"]).toBeInstanceOf(Temporal.Instant);
      expect(RefreshToken.create).not.toHaveBeenCalled();
    });

    it("refuses an expired token", async () => {
      RefreshToken.first.mockResolvedValue(
        stored({ expiresAt: Temporal.Now.instant().subtract({ seconds: 1 }) }),
      );

      await expect(service.refresh("old-token", undefined, REQ)).rejects.toThrow(refused);
      expect(RefreshToken.updateAndCount).not.toHaveBeenCalled();
    });

    it("treats losing a race for the same token as reuse", async () => {
      RefreshToken.first.mockResolvedValue(stored());
      // The claim finds the token already used; the revocation then updates the family.
      RefreshToken.updateAndCount.mockResolvedValueOnce(0).mockResolvedValueOnce(2);

      await expect(service.refresh("old-token", undefined, REQ)).rejects.toThrow(refused);
      expect(RefreshToken.filters).toContainEqual({ familyId: FAMILY_ID, revokedAt: null });
      expect(RefreshToken.create).not.toHaveBeenCalled();
    });

    it("refuses when the account is gone", async () => {
      RefreshToken.first.mockResolvedValue(stored());
      RefreshToken.updateAndCount.mockResolvedValue(1);
      User.first.mockResolvedValue(null);

      await expect(service.refresh("old-token", undefined, REQ)).rejects.toThrow(refused);
      expect(RefreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe("signOut", () => {
    it("revokes the family of the cookie's token", async () => {
      RefreshToken.first.mockResolvedValue({ userId: USER_ID, familyId: "family-1" });

      await service.signOut("old-token", REQ);

      expect(audit.record).toHaveBeenCalledWith(
        { userId: USER_ID, requestId: REQ },
        "auth.sign_out",
        ACCOUNT,
      );
      expect(RefreshToken.filters).toEqual([
        { tokenHash: hashToken("old-token") },
        { familyId: "family-1", revokedAt: null },
      ]);
      expect(RefreshToken.updateAndCount).toHaveBeenCalledOnce();
    });

    it("does nothing for a missing or unknown token", async () => {
      RefreshToken.first.mockResolvedValue(null);

      await service.signOut(undefined, REQ);
      await service.signOut("made-up", REQ);

      expect(RefreshToken.first).toHaveBeenCalledOnce();
      expect(RefreshToken.updateAndCount).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
