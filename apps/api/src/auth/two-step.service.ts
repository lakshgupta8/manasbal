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
export const WRONG_CODE = "That code is not right. Check the time on your phone and try again";
// The access token is valid but its account is gone (the nightly reset).
export const ACCOUNT_GONE = "Sign in again";

// One 30-second step either side, so a phone clock a little off still works.
const TOLERANCE_SECONDS = 30;

// Two-step sign-in with an authenticator app (TOTP), part 1: switching it on. The secret is
// stored only encrypted with TOTP_KEY, and the recovery codes only as hashes.
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

      // Two enables racing: only one switches it on.
      const now = Temporal.Now.instant();
      const claimed = await User.where({ id: who.userId, totpEnabledAt: null }).updateAndCount({
        totpEnabledAt: now,
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
}
