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

## Acting as a user

Sign-in doesn't exist yet. Outside production, endpoints under `/me` take the user's id in an `x-demo-user` header (pick one in Prisma Studio, see AGENTS.md). In production they always answer 401.

The API imports the request schemas from `@manasbal/types` at run time, so build that package before `start:dev`: `pnpm --filter @manasbal/types build`. `pnpm dev` does it for you.
