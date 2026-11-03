import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { totpKey } from "./totp-key.js";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

// Encrypts a short secret for the database: "v1.<iv>.<tag>.<ciphertext>", each base64url. A fresh
// 12-byte IV per call, so the same secret never encrypts to the same text; the GCM tag makes any
// change to the stored text fail to decrypt instead of giving a wrong secret.
export function seal(plain: string, key: Buffer = totpKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), body].map((p) => p.toString("base64url")).join(".");
}

export function open(sealed: string, key: Buffer = totpKey()): string {
  const [version, iv, tag, body] = sealed.split(".");
  if (version !== VERSION || iv === undefined || tag === undefined || body === undefined) {
    throw new Error("Not a sealed secret");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
