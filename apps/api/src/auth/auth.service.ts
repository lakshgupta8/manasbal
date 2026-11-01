import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { SignInInput, SignUpInput } from "@manasbal/types";
import { getDb } from "../prisma/db.js";
import { PasswordService } from "./password.service.js";
import {
  ACCESS_TOKEN_SECONDS,
  hashRefresh,
  REFRESH_TOKEN_HOURS,
  TokensService,
} from "./tokens.service.js";

// The one answer for every sign-up that can't go ahead, so strangers can't learn which emails exist.
export const SIGN_UP_FAILED = "We could not create this account";

// The one answer for "no such email" and "wrong password", so neither reveals which emails exist.
export const SIGN_IN_FAILED = "Email or password is wrong";

// The one answer for every refresh that can't go ahead: missing, unknown, used, expired or
// revoked. The client's only move is to sign in again.
export const REFRESH_FAILED = "Sign in again";

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
    private readonly tokens: Pick<TokensService, "signAccess" | "newRefresh">,
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
    try {
      // Visitor accounts are removed by the nightly reset.
      return await users.select(...FIELDS).create({
        email,
        name,
        passwordHash,
        role: "buyer",
        createdByVisitor: true,
      });
    } catch (error) {
      // Two sign-ups with the same email at once: the unique index stops the second.
      if ((await users.where({ email }).select("id").first()) !== null) {
        throw new BadRequestException(SIGN_UP_FAILED);
      }
      throw error;
    }
  }

  async signIn({ email, password }: SignInInput, userAgent: string | undefined) {
    const db = getDb();
    const user = await db.orm.public.User.where({ email })
      .select("id", "role", "passwordHash")
      .first();
    // An unknown email still costs one hash check, so both failures take about the same time.
    const ok = await this.passwords.verify(
      user?.passwordHash ?? (await this.dummyHash()),
      password,
    );
    if (user === null || !ok) throw new UnauthorizedException(SIGN_IN_FAILED);

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
      .where({ tokenHash: hashRefresh(token) })
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
      .orm.public.RefreshToken.where({ tokenHash: hashRefresh(token) })
      .select("familyId")
      .first();
    if (row !== null) await this.revokeFamily(row.familyId);
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
