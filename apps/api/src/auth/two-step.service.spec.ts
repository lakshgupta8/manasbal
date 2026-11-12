import { DEMO_EMAILS } from "@manasbal/types";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { generate, generateSecret } from "otplib";
import { TooManyTriesException } from "../errors/too-many-tries.exception.js";
import { userLockKey } from "./lockout.service.js";
import { hashRecoveryCode } from "./recovery-codes.js";
import { open, seal } from "./secret-box.js";
import {
  ACCOUNT_GONE,
  DEMO_TWO_STEP_OFF,
  SIGN_IN_AGAIN,
  TWO_STEP_ALREADY_ON,
  TWO_STEP_NOT_SET_UP,
  TWO_STEP_OFF,
  TwoStepService,
  WRONG_CODE,
} from "./two-step.service.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";
const WHO = { userId: USER_ID, requestId: "req-1" };

// What a where callback sees: each column condition comes back as readable text.
const ROW = {
  totpLastStep: {
    isNull: () => "totpLastStep is null",
    lt: (step: number) => `totpLastStep < ${step}`,
  },
};
const TOOLS = { fns: { or: (...conditions: unknown[]) => ({ or: conditions }) } };

// A stand-in for one ORM collection: where() records its filters (a callback's as the condition
// it builds); the terminal calls are mocks.
function fakeCollection() {
  const collection = {
    filters: [] as object[],
    where(filter: Record<string, unknown> | ((row: typeof ROW, tools: typeof TOOLS) => object)) {
      collection.filters.push(typeof filter === "function" ? filter(ROW, TOOLS) : filter);
      return collection;
    },
    select: () => collection,
    first: vi.fn<() => Promise<unknown>>(),
    createAndCount: vi.fn<(rows: object[]) => Promise<number>>(),
    updateAndCount: vi.fn<(patch: object) => Promise<number>>(),
    deleteAndCount: vi.fn<() => Promise<number>>(),
  };
  return collection;
}

let User = fakeCollection();
let RecoveryCode = fakeCollection();

vi.mock("../prisma/db.js", () => ({
  getDb: () => ({
    transaction: (work: (tx: object) => Promise<unknown>) =>
      work({ orm: { public: { User, RecoveryCode } } }),
  }),
}));

describe("TwoStepService", () => {
  const audit = { record: vi.fn<() => Promise<void>>() };
  const lockout = {
    assertOpen: vi.fn<(key: string) => Promise<void>>(),
    fail: vi.fn<(key: string) => Promise<boolean>>(),
    clear: vi.fn<(key: string) => Promise<void>>(),
  };
  const service = new TwoStepService(audit, lockout);
  const lockKey = userLockKey(USER_ID);

  beforeEach(() => {
    User = fakeCollection();
    RecoveryCode = fakeCollection();
    audit.record.mockReset().mockResolvedValue(undefined);
    lockout.assertOpen.mockReset().mockResolvedValue(undefined);
    lockout.fail.mockReset().mockResolvedValue(false);
    lockout.clear.mockReset().mockResolvedValue(undefined);
  });

  describe("setup", () => {
    it("stores a new secret encrypted, and answers it with the authenticator link", async () => {
      User.first.mockResolvedValue({ email: "asha@example.test", totpEnabledAt: null });
      User.updateAndCount.mockResolvedValue(1);

      const started = await service.setup(WHO);

      expect(started.secret).toMatch(/^[A-Z2-7]+=*$/);
      expect(started.otpauthUrl).toMatch(/^otpauth:\/\/totp\/Manasbal:asha%40example\.test\?/);
      expect(started.otpauthUrl).toContain(`secret=${started.secret}`);
      expect(started.otpauthUrl).toContain("issuer=Manasbal");
      const stored = (User.updateAndCount.mock.calls[0]?.[0] as { totpSecret: string }).totpSecret;
      expect(stored).not.toContain(started.secret);
      expect(open(stored)).toBe(started.secret);
      expect(User.filters).toEqual([{ id: USER_ID }, { id: USER_ID }]);
      expect(audit.record).toHaveBeenCalledWith(
        WHO,
        "auth.2fa.setup",
        { type: "user", id: USER_ID },
        { public: { User, RecoveryCode } },
      );
    });

    it("answers 409 when two-step is already on, and keeps the secret", async () => {
      User.first.mockResolvedValue({
        email: "a@example.test",
        totpEnabledAt: Temporal.Now.instant(),
      });

      await expect(service.setup(WHO)).rejects.toThrow(new ConflictException(TWO_STEP_ALREADY_ON));
      expect(User.updateAndCount).not.toHaveBeenCalled();
    });

    it("answers 401 when the account is gone", async () => {
      User.first.mockResolvedValue(null);

      await expect(service.setup(WHO)).rejects.toThrow(new UnauthorizedException(ACCOUNT_GONE));
    });

    it.each(Object.values(DEMO_EMAILS))(
      "answers 403 for the demo login %s, and stores no secret",
      async (email) => {
        User.first.mockResolvedValue({ email, totpEnabledAt: null });

        await expect(service.setup(WHO)).rejects.toThrow(new ForbiddenException(DEMO_TWO_STEP_OFF));
        expect(User.updateAndCount).not.toHaveBeenCalled();
        expect(audit.record).not.toHaveBeenCalled();
      },
    );
  });

  describe("enable", () => {
    const secret = generateSecret();
    const pending = () => ({ totpSecret: seal(secret), totpEnabledAt: null });

    it("switches on with a right code and answers 10 recovery codes, stored only as hashes", async () => {
      User.first.mockResolvedValue(pending());
      User.updateAndCount.mockResolvedValue(1);

      const { recoveryCodes } = await service.enable(WHO, await generate({ secret }));

      expect(recoveryCodes).toHaveLength(10);
      expect(new Set(recoveryCodes).size).toBe(10);
      expect(User.filters).toEqual([{ id: USER_ID }, { id: USER_ID, totpEnabledAt: null }]);
      expect(User.updateAndCount.mock.calls[0]?.[0]).toMatchObject({
        totpLastStep: Math.floor(Date.now() / 30_000),
      });
      expect(RecoveryCode.createAndCount).toHaveBeenCalledOnce();
      const stored = RecoveryCode.createAndCount.mock.calls[0]?.[0];
      expect(stored).toEqual(
        recoveryCodes.map((code) => ({
          userId: USER_ID,
          codeHash: hashRecoveryCode(code),
          createdByVisitor: true,
        })),
      );
      expect(JSON.stringify(stored)).not.toContain(recoveryCodes[0]);
      expect(audit.record).toHaveBeenCalledWith(
        WHO,
        "auth.2fa.enable",
        { type: "user", id: USER_ID },
        { public: { User, RecoveryCode } },
      );
    });

    it("refuses a wrong code, switches nothing on, and counts and audits it against the account", async () => {
      User.first.mockResolvedValue(pending());
      const right = await generate({ secret });
      const wrong = right === "000000" ? "111111" : "000000";

      await expect(service.enable(WHO, wrong)).rejects.toThrow(new BadRequestException(WRONG_CODE));
      expect(User.updateAndCount).not.toHaveBeenCalled();
      expect(RecoveryCode.createAndCount).not.toHaveBeenCalled();
      expect(lockout.assertOpen).toHaveBeenCalledWith(lockKey);
      expect(lockout.fail).toHaveBeenCalledWith(lockKey);
      expect(lockout.clear).not.toHaveBeenCalled();
      // Outside the transaction, which the wrong code rolled back.
      expect(audit.record).toHaveBeenCalledExactlyOnceWith(WHO, "auth.2fa.failed", {
        type: "user",
        id: USER_ID,
      });
    });

    it("records the lockout when the fifth wrong code locks the account", async () => {
      User.first.mockResolvedValue(pending());
      lockout.fail.mockResolvedValue(true);
      const right = await generate({ secret });

      await expect(service.enable(WHO, right === "000000" ? "111111" : "000000")).rejects.toThrow(
        WRONG_CODE,
      );
      expect(audit.record).toHaveBeenLastCalledWith(WHO, "auth.lockout", {
        type: "user",
        id: USER_ID,
      });
    });

    it("answers 429 while the account's codes are locked, before reading anything", async () => {
      lockout.assertOpen.mockRejectedValue(new TooManyTriesException("locked", 900));

      await expect(service.enable(WHO, "123456")).rejects.toThrow(TooManyTriesException);
      expect(User.first).not.toHaveBeenCalled();
    });

    it("starts the account's count again after a right code", async () => {
      User.first.mockResolvedValue(pending());
      User.updateAndCount.mockResolvedValue(1);

      await service.enable(WHO, await generate({ secret }));

      expect(lockout.clear).toHaveBeenCalledWith(lockKey);
      expect(lockout.fail).not.toHaveBeenCalled();
    });

    it("counts nothing when the code was not the problem", async () => {
      // Set-up never started: what a demo login would get, since set-up is refused for them.
      User.first.mockResolvedValue({ totpSecret: null, totpEnabledAt: null });

      await expect(service.enable(WHO, "123456")).rejects.toThrow(TWO_STEP_NOT_SET_UP);
      expect(lockout.fail).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it("answers 409 when two-step is already on", async () => {
      User.first.mockResolvedValue({
        totpSecret: seal(secret),
        totpEnabledAt: Temporal.Now.instant(),
      });

      await expect(service.enable(WHO, "123456")).rejects.toThrow(
        new ConflictException(TWO_STEP_ALREADY_ON),
      );
    });

    it("answers 409 to the loser of two enables racing", async () => {
      User.first.mockResolvedValue(pending());
      User.updateAndCount.mockResolvedValue(0);

      await expect(service.enable(WHO, await generate({ secret }))).rejects.toThrow(
        new ConflictException(TWO_STEP_ALREADY_ON),
      );
      expect(RecoveryCode.createAndCount).not.toHaveBeenCalled();
    });

    it("answers 400 when set-up was never started", async () => {
      User.first.mockResolvedValue({ totpSecret: null, totpEnabledAt: null });

      await expect(service.enable(WHO, "123456")).rejects.toThrow(
        new BadRequestException(TWO_STEP_NOT_SET_UP),
      );
    });

    it("answers 401 when the account is gone", async () => {
      User.first.mockResolvedValue(null);

      await expect(service.enable(WHO, "123456")).rejects.toThrow(
        new UnauthorizedException(ACCOUNT_GONE),
      );
    });
  });

  // The time step a code made now belongs to.
  const stepNow = () => Math.floor(Date.now() / 30_000);
  const auditTx = () => ({ public: { User, RecoveryCode } });
  const TARGET = { type: "user", id: USER_ID };

  describe("verifySignIn", () => {
    const secret = generateSecret();
    const enabled = (totpLastStep: number | null = null) => ({
      id: USER_ID,
      role: "customer",
      totpSecret: seal(secret),
      totpEnabledAt: Temporal.Now.instant(),
      totpLastStep,
    });

    it("takes a right app code, stores its time step, and audits the sign-in", async () => {
      User.first.mockResolvedValue(enabled());
      User.updateAndCount.mockResolvedValue(1);
      const step = stepNow();

      await expect(service.verifySignIn(WHO, await generate({ secret }))).resolves.toEqual({
        id: USER_ID,
        role: "customer",
      });

      // The step only moves forward, in one conditional update.
      expect(User.filters).toEqual([
        { id: USER_ID },
        { id: USER_ID },
        { or: ["totpLastStep is null", `totpLastStep < ${step}`] },
      ]);
      expect(User.updateAndCount).toHaveBeenCalledWith({ totpLastStep: step });
      expect(RecoveryCode.updateAndCount).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledOnce();
      expect(audit.record).toHaveBeenCalledWith(WHO, "auth.2fa.verify", TARGET, auditTx());
    });

    it("refuses the same app code a second time", async () => {
      User.first.mockResolvedValue(enabled(stepNow()));

      await expect(service.verifySignIn(WHO, await generate({ secret }))).rejects.toThrow(
        new UnauthorizedException(WRONG_CODE),
      );
      expect(User.updateAndCount).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it("lets only one of two sign-ins racing with the same code through", async () => {
      User.first.mockResolvedValue(enabled());
      // Both read the old step; the database lets only the first update move it.
      User.updateAndCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
      const code = await generate({ secret });

      const results = await Promise.allSettled([
        service.verifySignIn(WHO, code),
        service.verifySignIn(WHO, code),
      ]);

      expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected"]);
      expect((results[1] as PromiseRejectedResult).reason).toEqual(
        new UnauthorizedException(WRONG_CODE),
      );
      expect(audit.record).toHaveBeenCalledOnce();
    });

    it("refuses a wrong app code", async () => {
      User.first.mockResolvedValue(enabled());
      const right = await generate({ secret });

      await expect(
        service.verifySignIn(WHO, right === "000000" ? "111111" : "000000"),
      ).rejects.toThrow(new UnauthorizedException(WRONG_CODE));
      expect(User.updateAndCount).not.toHaveBeenCalled();
    });

    it("takes an unused recovery code once, marks it used, and audits both", async () => {
      User.first.mockResolvedValue(enabled());
      RecoveryCode.updateAndCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

      await expect(service.verifySignIn(WHO, "ABCDE-fghjk")).resolves.toEqual({
        id: USER_ID,
        role: "customer",
      });
      expect(RecoveryCode.filters).toEqual([
        { userId: USER_ID, codeHash: hashRecoveryCode("abcdefghjk"), usedAt: null },
      ]);
      const patch = RecoveryCode.updateAndCount.mock.calls[0]?.[0] as { usedAt: unknown };
      expect(patch.usedAt).toBeInstanceOf(Temporal.Instant);
      expect(audit.record.mock.calls.map((call) => (call as unknown[])[1])).toEqual([
        "auth.2fa.recovery_used",
        "auth.2fa.verify",
      ]);

      // The second use finds no unused code, and gets the same answer as a wrong app code.
      await expect(service.verifySignIn(WHO, "abcde-fghjk")).rejects.toThrow(
        new UnauthorizedException(WRONG_CODE),
      );
      expect(User.updateAndCount).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledTimes(2);
    });

    it.each([
      ["the account is gone", null],
      ["two-step was switched off", { ...enabled(), totpEnabledAt: null }],
      ["no secret is stored", { ...enabled(), totpSecret: null }],
    ])("answers 401 sign in again when %s", async (_case, user) => {
      User.first.mockResolvedValue(user);

      await expect(service.verifySignIn(WHO, "123456")).rejects.toThrow(
        new UnauthorizedException(SIGN_IN_AGAIN),
      );
    });
  });

  describe("disable", () => {
    const secret = generateSecret();
    const enabled = () => ({
      totpSecret: seal(secret),
      totpEnabledAt: Temporal.Now.instant(),
      totpLastStep: null,
    });

    it("switches off with a right code, removing the secret and every recovery code", async () => {
      User.first.mockResolvedValue(enabled());
      User.updateAndCount.mockResolvedValue(1);
      RecoveryCode.deleteAndCount.mockResolvedValue(9);

      await expect(service.disable(WHO, await generate({ secret }))).resolves.toBeUndefined();

      expect(User.updateAndCount).toHaveBeenLastCalledWith({
        totpSecret: null,
        totpEnabledAt: null,
        totpLastStep: null,
      });
      expect(RecoveryCode.filters).toEqual([{ userId: USER_ID }]);
      expect(RecoveryCode.deleteAndCount).toHaveBeenCalledOnce();
      expect(audit.record).toHaveBeenCalledWith(WHO, "auth.2fa.disable", TARGET, auditTx());
    });

    it("refuses a wrong code with 400, changes nothing, and counts and audits it", async () => {
      User.first.mockResolvedValue(enabled());
      RecoveryCode.updateAndCount.mockResolvedValue(0);

      await expect(service.disable(WHO, "abcde-fghjk")).rejects.toThrow(
        new BadRequestException(WRONG_CODE),
      );
      expect(User.updateAndCount).not.toHaveBeenCalled();
      expect(RecoveryCode.deleteAndCount).not.toHaveBeenCalled();
      expect(lockout.fail).toHaveBeenCalledWith(lockKey);
      expect(audit.record).toHaveBeenCalledExactlyOnceWith(WHO, "auth.2fa.failed", TARGET);
    });

    it("answers 429 while the account's codes are locked, and switches nothing off", async () => {
      lockout.assertOpen.mockRejectedValue(new TooManyTriesException("locked", 900));

      await expect(service.disable(WHO, "123456")).rejects.toThrow(TooManyTriesException);
      expect(User.first).not.toHaveBeenCalled();
      expect(User.updateAndCount).not.toHaveBeenCalled();
    });

    it.each([
      ["never switched on", { totpSecret: null, totpEnabledAt: null, totpLastStep: null }],
      [
        "set up but not switched on",
        { totpSecret: "v1.x", totpEnabledAt: null, totpLastStep: null },
      ],
      [
        "on without a secret",
        { totpSecret: null, totpEnabledAt: Temporal.Now.instant(), totpLastStep: null },
      ],
    ])("answers 409 when two-step is %s", async (_case, user) => {
      User.first.mockResolvedValue(user);

      await expect(service.disable(WHO, "123456")).rejects.toThrow(
        new ConflictException(TWO_STEP_OFF),
      );
    });

    it("answers 401 when the account is gone", async () => {
      User.first.mockResolvedValue(null);

      await expect(service.disable(WHO, "123456")).rejects.toThrow(
        new UnauthorizedException(ACCOUNT_GONE),
      );
    });
  });
});
