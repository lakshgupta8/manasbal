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

**Roles.** Every user has one role: `customer` (every new account), `seller`, `seller_staff`, `support` or `admin`; the list is `roleSchema` in `@manasbal/types`. An endpoint limits who may use it with `@UseGuards(AuthGuard, RolesGuard)` and `@Roles(...)` (`src/auth/roles.ts`); any other role gets 403. The role is read from the access token, so a changed role takes effect within 15 minutes. Today `/admin/*` is admin only; `test/roles.e2e-spec.ts` checks every guarded endpoint against every role.

**Confirming the email address.** With `MAIL_MODE=smtp` (the local default), sign-up mails a link to `${WEB_URL}/verify-email?token=…`; open the mail in Mailpit at http://localhost:8025 and post the token to `POST /auth/verify-email`. Until then sign-in answers 403 "Check your email to confirm your account". With `MAIL_MODE=off` (or unset, as in production and the tests) no mail is sent and new accounts are confirmed at once.

The API imports the request schemas from `@manasbal/types` at run time, so build that package before `start:dev`: `pnpm --filter @manasbal/types build`. `pnpm dev` does it for you.
