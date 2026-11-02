# 0011: First-party authentication

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

Visitors sign up and sign in to the shop with an email and a password. The API (NestJS on Fastify) signs them in itself; there is no outside identity provider. The storefront and the API live on different web addresses, so the browser treats them as different sites. Production has no mail server: the roadmap keeps email in Mailpit on a developer's machine until real mail is switched on in a later phase. The data is a public demo that is reset every night.

## Decision

- **Passwords are hashed with argon2id**, through the `@node-rs/argon2` package, with the OWASP minimum settings: 19 MiB of memory, 2 passes, 1 lane. Only the hash is stored.
- **The access token is a JWT** made with the `jose` package. It lasts 15 minutes, is sent as `Authorization: Bearer <token>`, and the page keeps it in memory only, never in `localStorage` or `sessionStorage`.
- **The refresh token is random and opaque.** The API stores only its hash and sends it in an `httpOnly` cookie. Every use replaces it with a new one (rotation). The tokens issued from one sign-in form a chain (a "family"); presenting a token that was already replaced revokes the whole family, so everyone holding it has to sign in again.
- **The refresh cookie is `SameSite=None; Secure` in production** (the storefront calls the API cross-site) **and `SameSite=Lax` locally.** CSRF protection for the cookie follows in Week 6.
- **Production runs with mail mode `off`.** A new account counts as verified at once. Verification and password-reset mail work locally and in tests through Mailpit.

## Why

**argon2id.** It is the OWASP first choice for password storage: it is memory-hard, so guessing on graphics cards or custom chips costs far more than with bcrypt or PBKDF2. `@node-rs/argon2` ships a prebuilt binary for every platform we use, so it needs no build script and nothing has to be allowed in `pnpm-workspace.yaml`. The OWASP minimum keeps a hash at tens of milliseconds on the free API instance, which is slow for an attacker but fine for a sign-in. Each hash gets its own random salt, so equal passwords never share a hash.

**Short access token in memory.** A JWT can be checked without a database lookup, which keeps every protected request cheap. Fifteen minutes limits how long a stolen token is useful. Keeping it in memory rather than `localStorage` means a script injected into the page cannot read it after a reload, and a reload simply gets a new one through the refresh cookie. `jose` is a small, dependency-free library that follows the JOSE standards and runs on Node's own crypto.

**Opaque, rotated refresh token in an httpOnly cookie.** The long-lived credential never reaches JavaScript, so cross-site scripting cannot steal it. Storing only a hash means a leaked database does not hand out working tokens. Rotation with family revocation detects theft: if an attacker and the real user both hold the same token, whichever uses it second presents a token that was already replaced, and the whole family is revoked.

**SameSite.** `Lax` is the safe default but is not sent on cross-site requests, and in production the storefront and the API are different sites, so the cookie has to be `SameSite=None`, which browsers accept only with `Secure`. `None` drops the browser's built-in CSRF protection, which is why CSRF protection is planned explicitly. Locally both run on `localhost`, so `Lax` works and needs no HTTPS.

**Mail off in production.** There is no free mail service in the plan before the later phase that adds one, and the demo must stay free to run. Marking accounts verified at once keeps sign-up working in the live demo, and the nightly reset deletes every visitor account anyway. The mail code still runs locally and in tests, so it is ready when real mail is switched on.

## Consequences

- Every protected endpoint checks the `Authorization` header; the stand-in demo-user header is replaced.
- The API needs a table of refresh tokens (hash, family, expiry, replaced and revoked times) and a signing secret for JWTs in every environment.
- A reload of the storefront makes one refresh call before it can call protected endpoints.
- Signing out revokes the refresh family and clears the cookie; an access token already issued stays valid until it expires (at most 15 minutes).
- Until the CSRF work lands, the production refresh cookie relies on `SameSite=None` plus the API's CORS allow-list.
- In production nobody receives a verification or reset email. Password reset works only locally until real mail is switched on.
- Changing any of this is a new record that supersedes this one.
