// The OWASP minimum for argon2id: 19 MiB of memory, 2 passes, 1 lane. See ADR 0011. The
// algorithm is the library's default, argon2id (its Algorithm enum is a const enum that
// isolatedModules cannot import); the spec checks every hash starts with $argon2id$.
// A file of its own, with no decorators, so the seed hashes the demo logins exactly as sign-up
// does.
export const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;
