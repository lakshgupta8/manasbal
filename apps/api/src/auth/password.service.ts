import { hash, verify } from "@node-rs/argon2";
import { Injectable } from "@nestjs/common";

// The OWASP minimum for argon2id: 19 MiB of memory, 2 passes, 1 lane. See ADR 0011. The
// algorithm is the library's default, argon2id (its Algorithm enum is a const enum that
// isolatedModules cannot import); the spec checks every hash starts with $argon2id$.
export const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService {
  // The result is a PHC string that carries the settings and a random salt, so equal passwords
  // never share a hash and verify() needs nothing else.
  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }
}
