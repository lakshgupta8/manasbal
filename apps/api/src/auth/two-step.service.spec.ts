import { BadRequestException, ConflictException, UnauthorizedException } from "@nestjs/common";
import { generate, generateSecret } from "otplib";
import { hashRecoveryCode } from "./recovery-codes.js";
import { open, seal } from "./secret-box.js";
import {
  ACCOUNT_GONE,
  TWO_STEP_ALREADY_ON,
  TWO_STEP_NOT_SET_UP,
  TwoStepService,
  WRONG_CODE,
} from "./two-step.service.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";
const WHO = { userId: USER_ID, requestId: "req-1" };

// A stand-in for one ORM collection: where() records its filters; the terminal calls are mocks.
function fakeCollection() {
  const collection = {
    filters: [] as object[],
    where(filter: object) {
      collection.filters.push(filter);
      return collection;
    },
    select: () => collection,
    first: vi.fn<() => Promise<unknown>>(),
    createAndCount: vi.fn<(rows: object[]) => Promise<number>>(),
    updateAndCount: vi.fn<(patch: object) => Promise<number>>(),
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
  const service = new TwoStepService(audit);

  beforeEach(() => {
    User = fakeCollection();
    RecoveryCode = fakeCollection();
    audit.record.mockReset().mockResolvedValue(undefined);
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

    it("refuses a wrong code and switches nothing on", async () => {
      User.first.mockResolvedValue(pending());
      const right = await generate({ secret });
      const wrong = right === "000000" ? "111111" : "000000";

      await expect(service.enable(WHO, wrong)).rejects.toThrow(new BadRequestException(WRONG_CODE));
      expect(User.updateAndCount).not.toHaveBeenCalled();
      expect(RecoveryCode.createAndCount).not.toHaveBeenCalled();
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
});
