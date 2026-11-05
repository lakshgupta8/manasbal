import { createHash } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { TooManyTriesException } from "../errors/too-many-tries.exception.js";
import type { ScriptRunner } from "../rate-limit/valkey-throttler.storage.js";
import { VALKEY } from "../valkey/valkey.module.js";

// 5 wrong tries within 15 minutes lock the email (or the account's second step) for 15 minutes.
export const LOCKOUT_LIMIT = 5;
export const LOCKOUT_MS = 15 * 60_000;
export const LOCKED_OUT = "Too many wrong tries. Wait 15 minutes and try again";

// Answers { failures, ms until the count expires }.
const READ_SCRIPT = `return { tonumber(redis.call('GET', KEYS[1]) or '0'), redis.call('PTTL', KEYS[1]) }`;

// Counts one failure. The first starts the 15-minute window; the one that reaches the limit
// restarts it, so the lock lasts 15 minutes from then. Every key expires by itself.
const FAIL_SCRIPT = `
local failures = redis.call('INCR', KEYS[1])
if failures == 1 or failures == tonumber(ARGV[2]) then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return failures
`;

const CLEAR_SCRIPT = `return redis.call('DEL', KEYS[1])`;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

// The Valkey key for an email: only its SHA-256 hash, never the email itself.
export function emailLockKey(email: string): string {
  return `lockout:email:${sha256(email.trim().toLowerCase())}`;
}

// The Valkey key for an account's second sign-in step, and for codes that switch two-step on or
// off: every wrong code counts against the account.
export function userLockKey(userId: string): string {
  return `lockout:user:${sha256(userId)}`;
}

// The Valkey key for one sign-in challenge, which allows at most LOCKOUT_LIMIT wrong codes.
export function challengeLockKey(challengeId: string): string {
  return `lockout:challenge:${sha256(challengeId)}`;
}

// Stops password and code guessing, counted in Valkey so every API instance shares the counts.
// Like the rate limiter, a Valkey outage lets requests through rather than take sign-in down.
@Injectable()
export class LockoutService {
  private readonly logger = new Logger(LockoutService.name);

  constructor(@Inject(VALKEY) private readonly client: ScriptRunner) {}

  // Answers 429 while the key is locked, whether or not the next try would be right.
  async assertOpen(key: string): Promise<void> {
    const [failures, ms] = ((await this.run(READ_SCRIPT, key)) ?? [0, 0]) as [number, number];
    if (failures >= LOCKOUT_LIMIT) {
      throw new TooManyTriesException(LOCKED_OUT, Math.max(1, Math.ceil(ms / 1000)));
    }
  }

  // Whether the key has had LOCKOUT_LIMIT failures, for a caller that answers its own way.
  async isLocked(key: string): Promise<boolean> {
    const [failures] = ((await this.run(READ_SCRIPT, key)) ?? [0]) as [number];
    return failures >= LOCKOUT_LIMIT;
  }

  // Counts a wrong try. Answers true when this one locked the key.
  async fail(key: string): Promise<boolean> {
    return (await this.run(FAIL_SCRIPT, key, LOCKOUT_MS, LOCKOUT_LIMIT)) === LOCKOUT_LIMIT;
  }

  // A right try starts the count again.
  async clear(key: string): Promise<void> {
    await this.run(CLEAR_SCRIPT, key);
  }

  private async run(script: string, key: string, ...args: number[]): Promise<unknown> {
    try {
      return await this.client.eval(script, 1, key, ...args);
    } catch (error) {
      this.logger.error(`Lockout store unavailable, letting the request through: ${String(error)}`);
      return null;
    }
  }
}
