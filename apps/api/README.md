# @manasbal/api

The Manasbal REST API: NestJS on the Fastify adapter.

```bash
pnpm --filter @manasbal/api start:dev    # http://localhost:3001/health
pnpm --filter @manasbal/api test         # unit tests
pnpm --filter @manasbal/api test:e2e     # end-to-end tests
```

## Database

Prisma ORM 8 (release candidate, [ADR 0007](../../docs/adr/0007-prisma-8-release-candidate.md)). Start the databases first (see "Local databases" in the root README).

The tables are written in `src/prisma/contract.prisma`. After changing it:

```bash
pnpm --filter @manasbal/api exec prisma contract emit                   # rewrites contract.json and contract.d.ts
pnpm --filter @manasbal/api exec prisma migration plan --name <name>    # writes migrations/app/<timestamp>_<name>
pnpm --filter @manasbal/api exec prisma migration show <folder>         # review the SQL
pnpm --filter @manasbal/api exec prisma db migrate --advance-ref db     # apply to your local database
```

Commit the contract, the generated files and `migrations/`. Don't edit the generated files by hand.

## Signing in

Protected endpoints (`/me`, `/me/addresses`, `/cart`, `/orders`, `/admin`) take an access token in `Authorization: Bearer <token>`. Get one from `POST /auth/sign-in` (sign up first with `POST /auth/sign-up`); it lasts 15 minutes, and `POST /auth/refresh` swaps the `refresh_token` cookie for a new one. Without a valid token they answer 401. The API signs tokens with `JWT_SECRET` (see `.env.example`) and refuses to start in production without it.

**Roles.** Every user has one role: `customer` (every new account), `seller`, `seller_staff`, `support` or `admin`; the list is `roleSchema` in `@manasbal/types`. An endpoint limits who may use it with `@UseGuards(AuthGuard, RolesGuard)` and `@Roles(...)` (`src/auth/roles.ts`); any other role gets 403. The role is read from the access token, so a changed role takes effect within 15 minutes. Today `/admin/audit-log` is admin only, `GET /admin/orders/:id` is for support and admin (each view is audited as `order.view`), and `PATCH /me/store` is for sellers; `test/roles.e2e-spec.ts` checks every guarded endpoint against every role.

**Two-step sign-in (set-up).** `POST /auth/2fa/setup` (signed in) makes an authenticator-app secret and answers it with an `otpauth://` link to show as a QR code; `POST /auth/2fa/enable` takes the app's 6-digit code, switches two-step on and answers 10 recovery codes, once. The secret is stored encrypted with `TOTP_KEY` (32 random bytes, base64; see `.env.example`), and the recovery codes only as hashes. Production refuses to start without a valid `TOTP_KEY`.

**Two-step sign-in (sign-in step).** With two-step on, a right password at `POST /auth/sign-in` answers `{ twoFactorRequired: true, challengeToken }` instead of tokens, and sets no cookie. The challenge is a 5-minute JWT with `purpose: "2fa-challenge"`: it is never accepted as an access token, nor an access token as a challenge. `POST /auth/2fa/verify` takes it with the app's 6-digit code or a recovery code and signs in exactly as sign-in does. Each code works once: a recovery code is marked used, and the time step of the last app code is stored (`users.totp_last_step`), both with a single conditional update, so two requests racing with one code can't both win. `POST /auth/2fa/disable` (signed in) takes a current code and switches two-step off.

**Lockout, origin checks and the auth audit log.** 5 wrong passwords for one email within 15 minutes lock that email for 15 minutes: sign-in then answers 429 (with `Retry-After`), even with the right password. An unknown email counts the same way, and a right password resets the count. Wrong codes at `POST /auth/2fa/verify` count against the account the same way. The counts live in Valkey under a SHA-256 hash of the email or user id, and expire by themselves; if Valkey is down, sign-in is let through, as with the rate limiter. `POST /auth/refresh` and `/auth/sign-out` take a request only when its `Origin` is in `WEB_ORIGINS` (see `.env.example`; production refuses to start without it); a request with no `Origin` is let through only when it carries no refresh cookie, so another site can't use a visitor's cookie. CORS allows the same origins, with credentials. Every auth event is in the audit log with the account id and request id, never an email or password.

**Sessions.** `GET /me/sessions` lists where the user is signed in: one entry per refresh-token family that still works, with a browser name made from the stored user agent, when it started, when it was last used, and whether it is the session of the access token in use. Access tokens carry the family id as an optional `sid` claim for that; the guard still checks them without a database lookup. `DELETE /me/sessions/:id` ends a session (its whole family is revoked, as on reuse) and is audited as `auth.session.end`; another user's or an unknown session answers 404.

**Ownership.** Code that loads a record by id checks its owner with `assertOwner` (`src/auth/assert-owner.ts`): another user's record answers 404, exactly like a missing one. Lists are filtered by the signed-in user, and a seller's store is found from the user, never from an id in the request.

**Confirming the email address.** With `MAIL_MODE=smtp` (the local default), sign-up mails a link to `${WEB_URL}/verify-email?token=…`; open the mail in Mailpit at http://localhost:8025 and post the token to `POST /auth/verify-email`. Until then sign-in answers 403 "Check your email to confirm your account". With `MAIL_MODE=off` (or unset, as in production and the tests) no mail is sent and new accounts are confirmed at once.

The API imports the request schemas from `@manasbal/types` at run time, so build that package before `start:dev`: `pnpm --filter @manasbal/types build`. `pnpm dev` does it for you.
