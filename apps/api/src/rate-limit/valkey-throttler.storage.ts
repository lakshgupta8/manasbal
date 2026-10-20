import { Logger } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface.js";

// The one thing the storage needs from the Valkey client (ioredis satisfies it).
export interface ScriptRunner {
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
}

// Fixed window, counted atomically in Valkey so every API instance shares the same counts.
// Once a visitor goes over the limit they are blocked for blockDuration; blocked requests
// are not counted again. Returns { hits, ms until the window ends, blocked, ms until unblocked }.
const HIT_SCRIPT = `
local blocked = redis.call('PTTL', KEYS[2])
if blocked > 0 then
  return { tonumber(redis.call('GET', KEYS[1]) or '0'), redis.call('PTTL', KEYS[1]), 1, blocked }
end
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local window = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  return { hits, window, 1, tonumber(ARGV[3]) }
end
return { hits, window, 0, 0 }
`;

const toSeconds = (ms: number): number => Math.max(0, Math.ceil(ms / 1000));

export class ValkeyThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(ValkeyThrottlerStorage.name);

  constructor(private readonly client: ScriptRunner) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitsKey = `throttle:${throttlerName}:${key}`;
    try {
      const [totalHits, windowMs, blocked, blockMs] = (await this.client.eval(
        HIT_SCRIPT,
        2,
        hitsKey,
        `${hitsKey}:blocked`,
        ttl,
        limit,
        blockDuration,
      )) as [number, number, number, number];
      return {
        totalHits,
        timeToExpire: toSeconds(windowMs),
        isBlocked: blocked === 1,
        timeToBlockExpire: toSeconds(blockMs),
      };
    } catch (error) {
      // A cache outage must not take the API down with it: let the request through.
      this.logger.error(
        `Rate limit store unavailable, letting the request through: ${String(error)}`,
      );
      return { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
    }
  }
}
