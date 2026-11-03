// TOTP_KEY encrypts the authenticator-app secrets: 32 random bytes, base64 (AES-256-GCM).
const KEY_BYTES = 32;

const MISSING = "TOTP_KEY is not set. Add it in Render → manasbal-api → Environment.";
const WRONG_SIZE = "TOTP_KEY must be 32 random bytes, base64-encoded";

// The key, read on use so a missing or broken key fails the first two-step request loudly.
export function totpKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const value = env["TOTP_KEY"];
  if (!value) throw new Error(MISSING);
  const key = Buffer.from(value, "base64");
  if (key.length !== KEY_BYTES) throw new Error(WRONG_SIZE);
  return key;
}

// Production must not start without a usable key; elsewhere an unset key fails on first use, but
// a key that is set and the wrong size stops the start everywhere.
export function requireTotpKey(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === "production" || env["TOTP_KEY"]) totpKey(env);
}
