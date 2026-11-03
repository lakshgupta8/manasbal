import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { TwoStepEnabled, TwoStepSetup } from "@manasbal/types";
import { generateSecret, generateURI, verify } from "otplib";
import { AuditService } from "../audit/audit.service.js";
import { getDb } from "../prisma/db.js";
import type { Actor } from "./current-user.js";
import { hashRecoveryCode, newRecoveryCodes } from "./recovery-codes.js";
import { open, seal } from "./secret-box.js";

// The name the authenticator app shows above the code.
export const ISSUER = "Manasbal";

export const TWO_STEP_ALREADY_ON = "Two-step sign-in is already on";
export const TWO_STEP_NOT_SET_UP = "Start the two-step set-up first";
export const TWO_STEP_OFF = "Two-step sign-in is not on";
export const WRONG_CODE = "That code is not right. Check the time on your phone and try again";
// The access token is valid but its account is gone (the nightly reset).
export const ACCOUNT_GONE = "Sign in again";
// The second step of sign-in can't go ahead: the challenge is expired or not one, or two-step was
// switched off since the password step. The client's only move is to sign in again.
export const SIGN_IN_AGAIN = "Sign in again";

// A 6-digit code from the app; anything else is taken as a recovery code.
const APP_CODE = /^\d{6}$/;

// A transaction's orm, as getDb().transaction hands it over.
type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

// What checking a code needs to know about the user.
interface TwoStepUser {
  totpSecret: string;
  totpLastStep: number | null;
}

// One 30-second step either side, so a phone clock a little off still works.
const TOLERANCE_SECONDS = 30;

// Two-step sign-in with an authenticator app (TOTP): switching it on and off, and the second step
// of sign-in. The secret is stored only encrypted with TOTP_KEY, and the recovery codes only as
// hashes.
@Injectable()
export class TwoStepService {
  // Typed as the part it uses: a class type makes the decorator metadata emit a branch that never
  // runs. @Inject still names the provider.
  constructor(@Inject(AuditService) private readonly audit: Pick<AuditService, "record">) {}

  // A new secret, stored encrypted but not switched on until a code from the app proves it was
  // added. Running set-up again replaces an unconfirmed secret.
  setup(who: Actor): Promise<TwoStepSetup> {
    return getDb().transaction(async (tx) => {
      const users = tx.orm.public.User;
      const user = await users.where({ id: who.userId }).select("email", "totpEnabledAt").first();
      if (user === null) throw new UnauthorizedException(ACCOUNT_GONE);
      if (user.totpEnabledAt !== null) throw new ConflictException(TWO_STEP_ALREADY_ON);

      const secret = generateSecret();
      await users.where({ id: who.userId }).updateAndCount({ totpSecret: seal(secret) });
      await this.audit.record(who, "auth.2fa.setup", { type: "user", id: who.userId }, tx.orm);
      return { otpauthUrl: generateURI({ issuer: ISSUER, label: user.email, secret }), secret };
    });
  }

  // Switches two-step on with a code from the app, and answers the recovery codes, once.
  enable(who: Actor, code: string): Promise<TwoStepEnabled> {
    return getDb().transaction(async (tx) => {
      const { RecoveryCode, User } = tx.orm.public;
      const user = await User.where({ id: who.userId })
        .select("totpSecret", "totpEnabledAt")
        .first();
      if (user === null) throw new UnauthorizedException(ACCOUNT_GONE);
      if (user.totpEnabledAt !== null) throw new ConflictException(TWO_STEP_ALREADY_ON);
      if (user.totpSecret === null) throw new BadRequestException(TWO_STEP_NOT_SET_UP);

      const result = await verify({
        secret: open(user.totpSecret),
        token: code,
        epochTolerance: TOLERANCE_SECONDS,
      });
      if (!result.valid) throw new BadRequestException(WRONG_CODE);

      // Two enables racing: only one switches it on. The code's time step is stored, so the same
      // code can't then be used to sign in.
      const claimed = await User.where({ id: who.userId, totpEnabledAt: null }).updateAndCount({
        totpEnabledAt: Temporal.Now.instant(),
        totpLastStep: (result as { timeStep: number }).timeStep,
      });
      if (claimed === 0) throw new ConflictException(TWO_STEP_ALREADY_ON);

      const recoveryCodes = newRecoveryCodes();
      // One insert for all of them. Visitor rows are removed by the nightly reset.
      await RecoveryCode.createAndCount(
        recoveryCodes.map((recoveryCode) => ({
          userId: who.userId,
          codeHash: hashRecoveryCode(recoveryCode),
          createdByVisitor: true,
        })),
      );
      await this.audit.record(who, "auth.2fa.enable", { type: "user", id: who.userId }, tx.orm);
      return { recoveryCodes };
    });
  }

  // The second step of sign-in, for the user a valid challenge named. Answers who to sign in.
  // A wrong code answers the same whether it looked like an app code or a recovery code.
  verifySignIn(who: Actor, code: string): Promise<{ id: string; role: string }> {
    return getDb().transaction(async (tx) => {
      const user = await tx.orm.public.User.where({ id: who.userId })
        .select("id", "role", "totpSecret", "totpEnabledAt", "totpLastStep")
        .first();
      // Gone, or switched off since the password step.
      if (user === null || user.totpEnabledAt === null || user.totpSecret === null) {
        throw new UnauthorizedException(SIGN_IN_AGAIN);
      }
      const totpSecret = user.totpSecret;
      if (!(await this.accept(tx, who, { ...user, totpSecret }, code))) {
        throw new UnauthorizedException(WRONG_CODE);
      }
      await this.audit.record(who, "auth.2fa.verify", { type: "user", id: who.userId }, tx.orm);
      return { id: user.id, role: user.role };
    });
  }

  // Switches two-step off with a current code, so an access token alone can't. The secret and
  // every recovery code go with it.
  disable(who: Actor, code: string): Promise<void> {
    return getDb().transaction(async (tx) => {
      const { RecoveryCode, User } = tx.orm.public;
      const user = await User.where({ id: who.userId })
        .select("totpSecret", "totpEnabledAt", "totpLastStep")
        .first();
      if (user === null) throw new UnauthorizedException(ACCOUNT_GONE);
      if (user.totpEnabledAt === null || user.totpSecret === null) {
        throw new ConflictException(TWO_STEP_OFF);
      }
      const totpSecret = user.totpSecret;
      if (!(await this.accept(tx, who, { ...user, totpSecret }, code))) {
        throw new BadRequestException(WRONG_CODE);
      }
      await User.where({ id: who.userId }).updateAndCount({
        totpSecret: null,
        totpEnabledAt: null,
        totpLastStep: null,
      });
      await RecoveryCode.where({ userId: who.userId }).deleteAndCount();
      await this.audit.record(who, "auth.2fa.disable", { type: "user", id: who.userId }, tx.orm);
    });
  }

  // Whether the code is right, used up so it can't work twice: a recovery code is marked used,
  // and an app code's time step is stored, so neither that code nor an older one works again.
  // Both claims are single conditional updates, so of two requests racing with the same code
  // only one wins.
  private async accept(tx: Tx, who: Actor, user: TwoStepUser, code: string): Promise<boolean> {
    const { RecoveryCode, User } = tx.orm.public;
    if (APP_CODE.test(code)) {
      const result = await verify({
        secret: open(user.totpSecret),
        token: code,
        epochTolerance: TOLERANCE_SECONDS,
        afterTimeStep: user.totpLastStep ?? undefined,
      });
      if (!result.valid) return false;
      // The result's type also covers counter-based codes; a time-based one always has its step.
      const step = (result as { timeStep: number }).timeStep;
      const claimed = await User.where({ id: who.userId })
        .where((row, { fns }) => fns.or(row.totpLastStep.isNull(), row.totpLastStep.lt(step)))
        .updateAndCount({ totpLastStep: step });
      return claimed === 1;
    }
    const used = await RecoveryCode.where({
      userId: who.userId,
      codeHash: hashRecoveryCode(code),
      usedAt: null,
    }).updateAndCount({ usedAt: Temporal.Now.instant() });
    if (used === 0) return false;
    await this.audit.record(
      who,
      "auth.2fa.recovery_used",
      { type: "user", id: who.userId },
      tx.orm,
    );
    return true;
  }
}
