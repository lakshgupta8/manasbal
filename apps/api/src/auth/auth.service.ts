import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { SignInInput, SignUpInput } from "@manasbal/types";
import { getDb } from "../prisma/db.js";
import { PasswordService } from "./password.service.js";
import { ACCESS_TOKEN_SECONDS, REFRESH_TOKEN_HOURS, TokensService } from "./tokens.service.js";

// The one answer for every sign-up that can't go ahead, so strangers can't learn which emails exist.
export const SIGN_UP_FAILED = "We could not create this account";

// The one answer for "no such email" and "wrong password", so neither reveals which emails exist.
export const SIGN_IN_FAILED = "Email or password is wrong";

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

    const refresh = this.tokens.newRefresh();
    // Each sign-in starts a new family; refreshing (Thursday's card) keeps it. Visitor sessions
    // are removed by the nightly reset.
    await db.orm.public.RefreshToken.create({
      userId: user.id,
      familyId: randomUUID(),
      tokenHash: refresh.hash,
      expiresAt: Temporal.Now.instant().add({ hours: REFRESH_TOKEN_HOURS }),
      userAgent: userAgent?.slice(0, USER_AGENT_MAX),
      createdByVisitor: true,
    });
    const accessToken = await this.tokens.signAccess(user);
    return { accessToken, expiresIn: ACCESS_TOKEN_SECONDS, refreshToken: refresh.token };
  }
}
