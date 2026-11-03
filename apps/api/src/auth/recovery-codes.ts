import { randomInt } from "node:crypto";
import { RECOVERY_CODE_COUNT } from "@manasbal/types";
import { hashToken } from "./tokens.service.js";

// Letters and digits that can't be mistaken for each other when typed (no 0/o, 1/l/i).
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const LENGTH = 10;

// One code as the user sees it: "abcde-fghjk" (about 49 bits of randomness).
function newCode(): string {
  const chars = Array.from({ length: LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
}

// The codes shown once when two-step sign-in is switched on; all different.
export function newRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(newCode());
  return [...codes];
}

// The stored form: case, spaces and hyphens don't matter when the code is typed back.
export function hashRecoveryCode(code: string): string {
  return hashToken(code.toLowerCase().replaceAll(/[\s-]/g, ""));
}
