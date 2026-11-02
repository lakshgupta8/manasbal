import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { SignInInput, SignUpInput } from "@manasbal/types";
import { readMailSettings } from "../mail/mail-settings.js";
import { MailerService } from "../mail/mailer.service.js";
import { getDb } from "../prisma/db.js";
import { PasswordService } from "./password.service.js";
import {
  ACCESS_TOKEN_SECONDS,
  hashToken,
  REFRESH_TOKEN_HOURS,
  TokensService,
} from "./tokens.service.js";
import { EMAIL_TOKEN_HOURS, VERIFY_EMAIL, verificationMail } from "./verification-mail.js";

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

const FIELDS = ["id", "email", "name"] as const;

// The longest user agent stored; anything after it is cut.
const USER_AGENT_MAX = 255;

@Injectable()
export class AuthService {
  // Typed as the parts it uses: a class type makes the decorator metadata emit a branch that
  // never runs. @Inject still names the provider.
  constructor(
    @Inject(PasswordService) private readonly passwords: Pick<PasswordService, "hash" | "verify">,
    @Inject(TokensService)
    private readonly tokens: Pick<TokensService, "signAccess" | "newRefresh" | "newEmailToken">,
    @Inject(MailerService) private readonly mailer: Pick<MailerService, "send">,
  ) {}

  // A real argon2id hash of nothing anyone knows, made on the first sign-in for an unknown email.
  private dummy: Promise<string> | undefined;

  private dummyHash(): Promise<string> {
    this.dummy ??= this.passwords.hash(randomUUID());
    return this.dummy;
  }

  async signUp({ email, password, name }: SignUpInput) {
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
        role: "buyer",
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
    // Only a new account gets a mail: a taken email has already been refused above.
    if (mailOn) await this.sendVerification(user);
    return user;
  }

  // Confirms the address of the account the link was sent to. The token works once; an unknown,
  // used or expired one gets the same answer.
  async verifyEmail(token: string): Promise<void> {
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
      return true;
    });
    if (!verified) throw new BadRequestException(LINK_INVALID);
  }

  async signIn({ email, password }: SignInInput, userAgent: string | undefined) {
    const db = getDb();
    const user = await db.orm.public.User.where({ email })
      .select("id", "role", "passwordHash", "emailVerifiedAt")
      .first();
    // An unknown email still costs one hash check, so both failures take about the same time.
    const ok = await this.passwords.verify(
      user?.passwordHash ?? (await this.dummyHash()),
      password,
    );
    if (user === null || !ok) throw new UnauthorizedException(SIGN_IN_FAILED);
    // Only after the right password, so a wrong one never tells whether the account is confirmed.
    // With mail off no link could arrive, so an older unconfirmed account is let in.
    if (user.emailVerifiedAt === null && readMailSettings().mode === "smtp") {
      throw new ForbiddenException(EMAIL_NOT_CONFIRMED);
    }

    // Each sign-in starts a new family; every refresh after it stays in that family.
    return this.issue(user, randomUUID(), userAgent);
  }

  // Swaps a refresh token for a new access token and a new refresh token in the same family.
  // A token works once: presenting one that was already used means someone kept a copy, so
  // every token in its family is revoked, the newest one included.
  async refresh(token: string | undefined, userAgent: string | undefined) {
    if (!token) throw new UnauthorizedException(REFRESH_FAILED);
    const tokens = getDb().orm.public.RefreshToken;
    const row = await tokens
      .where({ tokenHash: hashToken(token) })
      .select("id", "userId", "familyId", "expiresAt", "usedAt", "revokedAt")
      .first();
    if (row === null || row.revokedAt !== null) throw new UnauthorizedException(REFRESH_FAILED);
    if (row.usedAt !== null) return this.reuse(row.familyId);

    const now = Temporal.Now.instant();
    if (Temporal.Instant.compare(row.expiresAt, now) <= 0) {
      throw new UnauthorizedException(REFRESH_FAILED);
    }
    // Only one caller can mark an unused token used, so two refreshes racing with the same
    // token cannot both win: the loser counts as reuse.
    const claimed = await tokens
      .where({ id: row.id, usedAt: null })
      .updateAndCount({ usedAt: now });
    if (claimed === 0) return this.reuse(row.familyId);

    const user = await getDb()
      .orm.public.User.where({ id: row.userId })
      .select("id", "role")
      .first();
    if (user === null) throw new UnauthorizedException(REFRESH_FAILED);
    return this.issue(user, row.familyId, userAgent);
  }

  // Ends the session the cookie belongs to, on this device and any copy of it. An unknown or
  // missing token is fine: the cookie is cleared either way.
  async signOut(token: string | undefined): Promise<void> {
    if (!token) return;
    const row = await getDb()
      .orm.public.RefreshToken.where({ tokenHash: hashToken(token) })
      .select("familyId")
      .first();
    if (row !== null) await this.revokeFamily(row.familyId);
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

  private async reuse(familyId: string): Promise<never> {
    await this.revokeFamily(familyId);
    throw new UnauthorizedException(REFRESH_FAILED);
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await getDb()
      .orm.public.RefreshToken.where({ familyId, revokedAt: null })
      .updateAndCount({ revokedAt: Temporal.Now.instant() });
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
    const accessToken = await this.tokens.signAccess(user);
    return { accessToken, expiresIn: ACCESS_TOKEN_SECONDS, refreshToken: refresh.token };
  }
}
