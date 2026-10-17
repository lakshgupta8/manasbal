# 0007: Prisma ORM 8 (release candidate) for the API

- **Status:** Accepted
- **Date:** 2026-10-17

## Context

The API needs a typed database layer with versioned migrations. Prisma ORM 7 is the stable release; Prisma 8 is a release candidate, and the getting-started flow Prisma documents now scaffolds Prisma 8. The two differ: Prisma 8 keeps the schema in a "contract" (`contract.prisma`), emits `contract.json` and `contract.d.ts` instead of running `prisma generate`, and replaces `migrate dev` and `migrate deploy` with `migration plan` and `db migrate`.

## Decision

- Use **Prisma ORM 8**, pinned to exact versions (`prisma@8.0.0-rc.23`, `@prisma/orm-postgres@8.0.0-rc.18`), so an upgrade is always a deliberate change.
- The contract lives in `apps/api/src/prisma/`; the generated files and `apps/api/migrations/` are committed, but excluded from lint, formatting, coverage and Sonar analysis.
- Developers run `contract emit`, `migration plan`, then `db migrate --advance-ref db`. The release workflow runs `db migrate --to prod` once a `prod` ref is committed (`migration ref set prod <migration>`).

## Consequences

- Commands differ from most tutorials and from Prisma 7, and may still change before 8.0 is final. The pinned versions limit that risk; revisit this record when 8.0 is stable.
- Every migration is reviewed in a pull request before production runs it, because the release job only applies migrations that are already committed.
