import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";

export const ACCESS_TOKEN_SECONDS = 15 * 60;
export const REFRESH_TOKEN_HOURS = 14 * 24;
export const CHALLENGE_SECONDS = 5 * 60;

// The claim that marks a two-step challenge. An access token never has a purpose, so neither can
// stand in for the other.
export const CHALLENGE_PURPOSE = "2fa-challenge";

// The signing key, read on use so a missing JWT_SECRET fails the first sign-in loudly.
function secret(): Uint8Array {
  const value = process.env["JWT_SECRET"];
  if (!value) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(value);
}

// A verified challenge: whose second step it is, and which challenge it is, so its wrong codes
// can be counted on their own.
export interface Challenge {
  readonly userId: string;
  readonly challengeId: string;
}

// Access tokens (a JWT, HS256, 15 minutes) and refresh tokens (random, stored only as a hash).
// See ADR 0011.
@Injectable()
export class TokensService {
  // async, so a missing JWT_SECRET is a rejected promise rather than a synchronous throw.
  // sid is the session (refresh-token family) the token was issued for, so the sessions list can
  // mark the current one. It is optional: tokens from before it have none.
  async signAccess(user: { id: string; role: string }, sessionId?: string): Promise<string> {
    return new SignJWT(
      sessionId === undefined ? { role: user.role } : { role: user.role, sid: sessionId },
    )
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_SECONDS}s`)
      .sign(secret());
  }

  // `now` lets a test check the expiry without fake timers.
  async verifyAccess(token: string, now?: Date): Promise<JWTPayload> {
    const payload = await verifyToken(token, now);
    if (payload["purpose"] !== undefined) throw new Error("Not an access token");
    return payload;
  }

  // The token sign-in answers when the password is right and two-step is on. It can do nothing
  // but the second step, for 5 minutes. Its jti names it, so its wrong codes are counted alone.
  async signChallenge(userId: string): Promise<string> {
    return new SignJWT({ purpose: CHALLENGE_PURPOSE })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(`${CHALLENGE_SECONDS}s`)
      .sign(secret());
  }

  // The user and id of a valid challenge. Anything else throws, an access token included. A
  // challenge from before challenges had a jti is named by the token itself.
  async verifyChallenge(token: string, now?: Date): Promise<Challenge> {
    const payload = await verifyToken(token, now);
    if (payload["purpose"] !== CHALLENGE_PURPOSE || typeof payload.sub !== "string") {
      throw new Error("Not a two-step challenge");
    }
    return { userId: payload.sub, challengeId: payload.jti ?? token };
  }

  // 32 random bytes for the cookie; only the SHA-256 hash is stored.
  newRefresh(): { token: string; hash: string } {
    return newToken();
  }

  // The same for the one-time link in an email (EmailToken).
  newEmailToken(): { token: string; hash: string } {
    return newToken();
  }
}

// Pinning the algorithm stops a token signed any other way from being accepted.
async function verifyToken(token: string, now: Date | undefined): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, secret(), {
    algorithms: ["HS256"],
    currentDate: now,
  });
  return payload;
}

function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

// The stored form of a refresh or email token.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
