import { Inject, Injectable } from "@nestjs/common";
import { VALKEY } from "../valkey/valkey.module.js";

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
// A request still being worked on holds its key this long, so a crash mid-request
// does not lock the key for a whole day.
export const IN_PROGRESS_TTL_MS = 60 * 1000;

export interface StoredResponse {
  status: number;
  body: unknown;
}

// `response` is missing while the first request is still running.
export interface IdempotencyRecord {
  fingerprint: string;
  response?: StoredResponse;
}

// The few Valkey commands the store needs (ioredis satisfies it).
export interface KeyValueClient {
  set(key: string, value: string, px: "PX", ms: number, nx: "NX"): Promise<"OK" | null>;
  set(key: string, value: string, px: "PX", ms: number): Promise<"OK">;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
}

@Injectable()
export class IdempotencyStore {
  constructor(@Inject(VALKEY) private readonly client: KeyValueClient) {}

  // Claims the key for this request. Returns null when the claim worked, or the record
  // already stored under the key.
  async claim(key: string, fingerprint: string): Promise<IdempotencyRecord | null> {
    const record: IdempotencyRecord = { fingerprint };
    const claimed = await this.client.set(
      this.keyOf(key),
      JSON.stringify(record),
      "PX",
      IN_PROGRESS_TTL_MS,
      "NX",
    );
    if (claimed === "OK") return null;
    const existing = await this.client.get(this.keyOf(key));
    // The claim can expire between the two calls; then this request simply tries again.
    return existing === null
      ? this.claim(key, fingerprint)
      : (JSON.parse(existing) as IdempotencyRecord);
  }

  async complete(key: string, fingerprint: string, response: StoredResponse): Promise<void> {
    const record: IdempotencyRecord = { fingerprint, response };
    await this.client.set(this.keyOf(key), JSON.stringify(record), "PX", IDEMPOTENCY_TTL_MS);
  }

  // Frees the key after a failed request, so the client can retry with the same key.
  async release(key: string): Promise<void> {
    await this.client.del(this.keyOf(key));
  }

  private keyOf(key: string): string {
    return `idempotency:${key}`;
  }
}
