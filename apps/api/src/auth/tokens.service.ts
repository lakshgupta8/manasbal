import { createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";

export const ACCESS_TOKEN_SECONDS = 15 * 60;
export const REFRESH_TOKEN_HOURS = 14 * 24;

// The signing key, read on use so a missing JWT_SECRET fails the first sign-in loudly.
function secret(): Uint8Array {
  const value = process.env["JWT_SECRET"];
  if (!value) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(value);
}

// Access tokens (a JWT, HS256, 15 minutes) and refresh tokens (random, stored only as a hash).
// See ADR 0011.
@Injectable()
export class TokensService {
  // async, so a missing JWT_SECRET is a rejected promise rather than a synchronous throw.
  async signAccess(user: { id: string; role: string }): Promise<string> {
    return new SignJWT({ role: user.role })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_SECONDS}s`)
      .sign(secret());
  }

  // Pinning the algorithm stops a token signed any other way from being accepted. `now` lets a
  // test check the expiry without fake timers.
  async verifyAccess(token: string, now?: Date): Promise<JWTPayload> {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
      currentDate: now,
    });
    return payload;
  }

  // 32 random bytes for the cookie; only the SHA-256 hash is stored.
  newRefresh(): { token: string; hash: string } {
    const token = randomBytes(32).toString("base64url");
    return { token, hash: hashRefresh(token) };
  }
}

export function hashRefresh(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
