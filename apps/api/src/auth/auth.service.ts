import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import {
  NEW_ACCOUNT_ROLE,
  type SignInInput,
  type SignUpInput,
  type TwoStepVerifyInput,
} from "@manasbal/types";
import { AuditService, type AuditWho } from "../audit/audit.service.js";
import { readMailSettings } from "../mail/mail-settings.js";
import { MailerService } from "../mail/mailer.service.js";
import { getDb } from "../prisma/db.js";
import { emailLockKey, LockoutService, userLockKey } from "./lockout.service.js";
import { PasswordService } from "./password.service.js";
import { revokeFamily } from "./revoke-family.js";
import {
  ACCESS_TOKEN_SECONDS,
  hashToken,
  REFRESH_TOKEN_HOURS,
  TokensService,
} from "./tokens.service.js";
import { SIGN_IN_AGAIN, TwoStepService, WRONG_CODE } from "./two-step.service.js";
import {
  EMAIL_TOKEN_HOURS,
  RESET_PASSWORD,
  RESET_TOKEN_HOURS,
  resetMail,
  VERIFY_EMAIL,
  verificationMail,
} from "./verification-mail.js";

// The one answer for every sign-up that can't go ahead, so strangers can't learn which emails exist.
export const SIGN_UP_FAILED = "We could not create this account";

// The one answer for "no such email" and "wrong password", so neither reveals which emails exist.
export const SIGN_IN_FAILED = "Email or password is wrong";

// The one answer for every refresh that can't go ahead: missing, unknown, used, expired or
// revoked. The client's only move is to sign in again.
export const REFRESH_FAILED = "Sign in again";

// A right password on an account whose email address is not confirmed yet.
export const EMAIL_NOT_CONFIRMED = "Check your email to confirm your account";

// The one answer for an unknown, used or expired confirmation link.
export const LINK_INVALID = "This link is not valid any more";

// What is in a log when a reset mail could not be sent: never the address or the token.
export const RESET_MAIL_FAILED = "Could not send a password reset mail";

const FIELDS = ["id", "email", "name"] as const;

// The longest user agent stored; anything after it is cut.
const USER_AGENT_MAX = 255;

// The audit target of an account's own auth events.
const account = (id: string) => ({ type: "user", id });

@Injectable()
export class AuthService {
  // Typed as the parts it uses: a class type makes the decorator metadata emit a branch that
  // never runs. @Inject still names the provider.
  constructor(
    @Inject(PasswordService) private readonly passwords: Pick<PasswordService, "hash" | "verify">,
    @Inject(TokensService)
    private readonly tokens: Pick<
      TokensService,
      "signAccess" | "newRefresh" | "newEmailToken" | "signChallenge" | "verifyChallenge"
    >,
    @Inject(MailerService) private readonly mailer: Pick<MailerService, "send">,
    @Inject(TwoStepService) private readonly twoStep: Pick<TwoStepService, "verifySignIn">,
    @Inject(LockoutService)
    private readonly lockout: Pick<LockoutService, "assertOpen" | "fail" | "clear">,
    @Inject(AuditService) private readonly audit: Pick<AuditService, "record">,
  ) {}

  private readonly logger = new Logger(AuthService.name);

  // A real argon2id hash of nothing anyone knows, made on the first sign-in for an unknown email.
  private dummy: Promise<string> | undefined;

  private dummyHash(): Promise<string> {
    this.dummy ??= this.passwords.hash(randomUUID());
    return this.dummy;
  }

  async signUp({ email, password, name }: SignUpInput, requestId: string) {
    // Hash first, so a taken email answers no faster than a free one.
    const passwordHash = await this.passwords.hash(password);
    const users = getDb().orm.public.User;
    if ((await users.where({ email }).select("id").first()) !== null) {
      throw new BadRequestException(SIGN_UP_FAILED);
    }
    // With mail off nothing could confirm the address, so the account counts as confirmed now.
    const mailOn = readMailSettings().mode === "smtp";
    let user: { id: string; email: string; name: string };
    try {
      // Visitor accounts are removed by the nightly reset.
      user = await users.select(...FIELDS).create({
        email,
        name,
        passwordHash,
        role: NEW_ACCOUNT_ROLE,
        emailVerifiedAt: mailOn ? null : Temporal.Now.instant(),
        createdByVisitor: true,
      });
    } catch (error) {
      // Two sign-ups with the same email at once: the unique index stops the second.
      if ((await users.where({ email }).select("id").first()) !== null) {
        throw new BadRequestException(SIGN_UP_FAILED);
      }
      throw error;
    }
    await this.audit.record({ userId: user.id, requestId }, "auth.sign_up", account(user.id));
    // Only a new account gets a mail: a taken email has already been refused above.
    if (mailOn) await this.sendVerification(user);
    return user;
  }

  // Confirms the address of the account the link was sent to. The token works once; an unknown,
  // used or expired one gets the same answer.
  async verifyEmail(token: string, requestId: string): Promise<void> {
    const now = Temporal.Now.instant();
    const verified = await getDb().transaction(async (tx) => {
      const tokens = tx.orm.public.EmailToken;
      const row = await tokens
        .where({ tokenHash: hashToken(token), purpose: VERIFY_EMAIL })
        .select("id", "userId", "expiresAt", "usedAt")
        .first();
      if (row === null || row.usedAt !== null) return false;
      if (Temporal.Instant.compare(row.expiresAt, now) <= 0) return false;
      // Two clicks racing with the same link: only one marks it used.
      const claimed = await tokens
        .where({ id: row.id, usedAt: null })
        .updateAndCount({ usedAt: now });
      if (claimed === 0) return false;
      await tx.orm.public.User.where({ id: row.userId, emailVerifiedAt: null }).updateAndCount({
        emailVerifiedAt: now,
      });
      await this.audit.record(
        { userId: row.userId, requestId },
        "auth.email.verify",
        account(row.userId),
        tx.orm,
      );
      return true;
    });
    if (!verified) throw new BadRequestException(LINK_INVALID);
  }

  // Answers at once, whether or not the email has an account, and does the work afterwards: the
  // answer can't depend on the account, in what it says or in how long it takes.
  forgotPassword(email: string, requestId: string): void {
    this.sendReset(email, requestId).catch((error: unknown) => {
      const kind = error instanceof Error ? error.name : "unknown error";
      this.logger.error(`${RESET_MAIL_FAILED} (${kind})`);
    });
  }

  // Sets a new password with the token from a reset link. The token works once; an unknown, used
  // or expired one gets the same answer. Every session ends, so a thief who had the old
  // password is signed out, and getting the mail proves the address.
  async resetPassword(token: string, password: string, requestId: string): Promise<void> {
    // Hashing is slow, so it happens before the transaction opens.
    const passwordHash = await this.passwords.hash(password);
    const now = Temporal.Now.instant();
    const reset = await getDb().transaction(async (tx) => {
      const { EmailToken, RefreshToken, User } = tx.orm.public;
      const row = await EmailToken.where({ tokenHash: hashToken(token), purpose: RESET_PASSWORD })
        .select("id", "userId", "expiresAt", "usedAt")
        .first();
      if (row === null || row.usedAt !== null) return false;
      if (Temporal.Instant.compare(row.expiresAt, now) <= 0) return false;
      // Two uses racing with the same link: only one marks it used.
      const claimed = await EmailToken.where({ id: row.id, usedAt: null }).updateAndCount({
        usedAt: now,
      });
      if (claimed === 0) return false;
      const userId = row.userId;
      await User.where({ id: userId }).updateAndCount({ passwordHash });
      await User.where({ id: userId, emailVerifiedAt: null }).updateAndCount({
        emailVerifiedAt: now,
      });
      await RefreshToken.where({ userId, revokedAt: null }).updateAndCount({ revokedAt: now });
      // Any other reset link still in a mailbox stops working too.
      await EmailToken.where({ userId, purpose: RESET_PASSWORD, usedAt: null }).updateAndCount({
        usedAt: now,
      });
      await this.audit.record(
        { userId, requestId },
        "auth.password_reset.complete",
        account(userId),
        tx.orm,
      );
      return true;
    });
    if (!reset) throw new BadRequestException(LINK_INVALID);
  }

  async signIn({ email, password }: SignInInput, userAgent: string | undefined, requestId: string) {
    // A locked email answers 429 even with the right password, before the password is checked.
    const lockKey = emailLockKey(email);
    await this.lockout.assertOpen(lockKey);
    const db = getDb();
    const user = await db.orm.public.User.where({ email })
      .select("id", "role", "passwordHash", "emailVerifiedAt", "totpEnabledAt")
      .first();
    // An unknown email still costs one hash check, so both failures take about the same time.
    const ok = await this.passwords.verify(
      user?.passwordHash ?? (await this.dummyHash()),
      password,
    );
    if (user === null || !ok) {
      // An unknown email and a wrong password count and are recorded the same way, with no
      // email: the actor is the account when there is one.
      await this.failed(lockKey, { userId: user?.id ?? null, requestId }, "auth.sign_in.failed");
      throw new UnauthorizedException(SIGN_IN_FAILED);
    }
    await this.lockout.clear(lockKey);
    const who = { userId: user.id, requestId };
    // Only after the right password, so a wrong one never tells whether the account is confirmed.
    // With mail off no link could arrive, so an older unconfirmed account is let in.
    if (user.emailVerifiedAt === null && readMailSettings().mode === "smtp") {
      throw new ForbiddenException(EMAIL_NOT_CONFIRMED);
    }

    // With two-step on, the right password earns only a challenge: no tokens until the code.
    if (user.totpEnabledAt !== null) {
      await this.audit.record(who, "auth.2fa.challenge", account(user.id));
      return {
        twoFactorRequired: true as const,
        challengeToken: await this.tokens.signChallenge(user.id),
      };
    }

    await this.audit.record(who, "auth.sign_in", account(user.id));
    // Each sign-in starts a new family; every refresh after it stays in that family.
    return this.issue(user, randomUUID(), userAgent);
  }

  // The second step of sign-in: the challenge from the password step and a code. A right code
  // signs in exactly as sign-in does without two-step.
  async verifyTwoStep(
    { challengeToken, code }: TwoStepVerifyInput,
    userAgent: string | undefined,
    requestId: string,
  ) {
    const userId = await this.tokens.verifyChallenge(challengeToken).catch(() => null);
    if (userId === null) throw new UnauthorizedException(SIGN_IN_AGAIN);
    // Wrong codes count against the account, so a challenge can't be used to guess the code.
    const lockKey = userLockKey(userId);
    await this.lockout.assertOpen(lockKey);
    const who = { userId, requestId };
    const user = await this.twoStep.verifySignIn(who, code).catch(async (error: unknown) => {
      if (error instanceof UnauthorizedException && error.message === WRONG_CODE) {
        await this.failed(lockKey, who, "auth.2fa.failed");
      }
      throw error;
    });
    await this.lockout.clear(lockKey);
    return this.issue(user, randomUUID(), userAgent);
  }

  // Swaps a refresh token for a new access token and a new refresh token in the same family.
  // A token works once: presenting one that was already used means someone kept a copy, so
  // every token in its family is revoked, the newest one included.
  async refresh(token: string | undefined, userAgent: string | undefined, requestId: string) {
    if (!token) throw new UnauthorizedException(REFRESH_FAILED);
    const tokens = getDb().orm.public.RefreshToken;
    const row = await tokens
      .where({ tokenHash: hashToken(token) })
      .select("id", "userId", "familyId", "expiresAt", "usedAt", "revokedAt", "userAgent")
      .first();
    if (row === null || row.revokedAt !== null) throw new UnauthorizedException(REFRESH_FAILED);
    if (row.usedAt !== null) return this.reuse(row, requestId);

    const now = Temporal.Now.instant();
    if (Temporal.Instant.compare(row.expiresAt, now) <= 0) {
      throw new UnauthorizedException(REFRESH_FAILED);
    }
    // Only one caller can mark an unused token used, so two refreshes racing with the same
    // token cannot both win: the loser counts as reuse.
    const claimed = await tokens
      .where({ id: row.id, usedAt: null })
      .updateAndCount({ usedAt: now });
    if (claimed === 0) return this.reuse(row, requestId);

    const user = await getDb()
      .orm.public.User.where({ id: row.userId })
      .select("id", "role")
      .first();
    if (user === null) throw new UnauthorizedException(REFRESH_FAILED);
    // A refresh without a user agent keeps the session's, so the sessions list can still name it.
    return this.issue(user, row.familyId, userAgent ?? row.userAgent ?? undefined);
  }

  // Ends the session the cookie belongs to, on this device and any copy of it. An unknown or
  // missing token is fine: the cookie is cleared either way.
  async signOut(token: string | undefined, requestId: string): Promise<void> {
    if (!token) return;
    const row = await getDb()
      .orm.public.RefreshToken.where({ tokenHash: hashToken(token) })
      .select("userId", "familyId")
      .first();
    if (row === null) return;
    await revokeFamily(row.familyId);
    await this.audit.record(
      { userId: row.userId, requestId },
      "auth.sign_out",
      account(row.userId),
    );
  }

  // A one-time link, stored only as its hash; visitor rows are removed by the nightly reset.
  private async sendVerification(user: { id: string; email: string }): Promise<void> {
    const { token, hash } = this.tokens.newEmailToken();
    await getDb().orm.public.EmailToken.create({
      userId: user.id,
      purpose: VERIFY_EMAIL,
      tokenHash: hash,
      expiresAt: Temporal.Now.instant().add({ hours: EMAIL_TOKEN_HOURS }),
      createdByVisitor: true,
    });
    await this.mailer.send(verificationMail(user.email, token));
  }

  // Only an existing account gets a link; an unknown email ends here, unseen by the caller.
  private async sendReset(email: string, requestId: string): Promise<void> {
    const user = await getDb().orm.public.User.where({ email }).select("id", "email").first();
    if (user === null) return;
    const { token, hash } = this.tokens.newEmailToken();
    await getDb().orm.public.EmailToken.create({
      userId: user.id,
      purpose: RESET_PASSWORD,
      tokenHash: hash,
      expiresAt: Temporal.Now.instant().add({ hours: RESET_TOKEN_HOURS }),
      createdByVisitor: true,
    });
    await this.audit.record(
      { userId: user.id, requestId },
      "auth.password_reset.request",
      account(user.id),
    );
    await this.mailer.send(resetMail(user.email, token));
  }

  // Someone kept a copy of a used token: the session ends, and the event is recorded.
  private async reuse(
    row: { userId: string; familyId: string },
    requestId: string,
  ): Promise<never> {
    await revokeFamily(row.familyId);
    await this.audit.record(
      { userId: row.userId, requestId },
      "auth.refresh.reuse",
      account(row.userId),
    );
    throw new UnauthorizedException(REFRESH_FAILED);
  }

  // Records a wrong password or code and counts it; the try that locks the key is recorded too.
  private async failed(lockKey: string, who: AuditWho, action: string): Promise<void> {
    const target = who.userId === null ? null : account(who.userId);
    await this.audit.record(who, action, target);
    if (await this.lockout.fail(lockKey)) await this.audit.record(who, "auth.lockout", target);
  }

  // A new refresh token in the family, stored only as its hash, and an access token. Visitor
  // sessions are removed by the nightly reset.
  private async issue(
    user: { id: string; role: string },
    familyId: string,
    userAgent: string | undefined,
  ) {
    const refresh = this.tokens.newRefresh();
    await getDb().orm.public.RefreshToken.create({
      userId: user.id,
      familyId,
      tokenHash: refresh.hash,
      expiresAt: Temporal.Now.instant().add({ hours: REFRESH_TOKEN_HOURS }),
      userAgent: userAgent?.slice(0, USER_AGENT_MAX),
      createdByVisitor: true,
    });
    // The family id goes into the access token as its session, for the sessions list.
    const accessToken = await this.tokens.signAccess(user, familyId);
    return { accessToken, expiresIn: ACCESS_TOKEN_SECONDS, refreshToken: refresh.token };
  }
}
