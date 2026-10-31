# @manasbal/seed

Fills a database with made-up demo data: people, a catalog, coupons, orders, payments, reviews and seller settlements. Every row is flagged `is_sample`. The data comes from a fixed seed, so every run writes exactly the same rows.

## Commands

Run from the repo root. Both read `DATABASE_URL` from `apps/api/.env` unless it is already set.

| What                                             | Command                                               |
| ------------------------------------------------ | ----------------------------------------------------- |
| Seed an empty database                           | `pnpm --filter @manasbal/seed seed --profile minimal` |
| Wipe and seed again                              | `pnpm seed:reset --profile demo`                      |
| See what a reset would write, without connecting | `pnpm seed:reset --profile demo --dry-run`            |

`seed:reset` uses the `demo` profile unless `--profile` says otherwise; `seed` uses `minimal`.

## ⚠️ The reset deletes everything

`seed:reset` empties **every table** in the database, then seeds again. It runs only when both of these are true:

1. `SEED_ALLOW_RESET=true` is set in the environment.
2. The database has a row in `_demo_marker`. Only the seed writes it.

Never set `SEED_ALLOW_RESET` in a shell that points at a database you care about.

A reset runs in this order: the guard above, the API's migrations (`prisma db migrate`), then the truncate and the new seed in one transaction. If seeding fails, the truncate rolls back and the database is left as it was.

The migrations go as far as every committed one, or only up to the ref in `SEED_MIGRATE_TO` when it is set (for example `SEED_MIGRATE_TO=prod`).

## A brand-new database

A new database has no `_demo_marker` row, so the reset refuses. Bring it up to date and seed it once, then reset works from then on:

```sh
pnpm --filter @manasbal/api exec prisma db migrate
pnpm --filter @manasbal/seed seed --profile demo
```

`seed` only inserts: on a database that already has the seed's rows it fails on duplicate keys. Use `seed:reset` for that.

## The nightly reset of the live demo

`.github/workflows/seed-demo.yml` runs `pnpm seed:reset --profile demo` every night at 21:00 UTC (02:30 IST), and on demand from **Actions → Reset demo data**. Then it checks that the live API lists products again.

- **Released code only:** the scheduled run checks out `main` and sets `SEED_MIGRATE_TO=prod`, so the live database never gets a migration that no released API uses. A manual run can choose another branch.
- **Direct connection:** the `demo` environment's `DATABASE_URL` secret is Neon's direct string, with pooling off (the same string as `DIRECT_URL`). `TRUNCATE` and migrations must not go through the pooler.

### One-time step: mark the live database

The live database was never seeded by `seed`, so it has no `_demo_marker` row and the first reset refuses. That is the guard working; there is no option to skip it. Mark the database once, by hand:

1. Neon → the project → **SQL Editor**. Check the branch is `production` (the one the live API uses) and the database is `manasbal`, the demo database and nothing else.
2. Check the release with the `_demo_marker` migration is live: `SELECT count(*) FROM "_demo_marker";` returns `0` (an error means the table doesn't exist yet: release first).
3. Run:

   ```sql
   INSERT INTO "_demo_marker" (id, name, created_at) VALUES (gen_random_uuid(), 'manasbal-demo', now());
   ```

After the first reset, the seed writes the marker itself.

## Profiles

| Profile   | Customers | Sellers | Products | Orders | Where                                                |
| --------- | --------- | ------- | -------- | ------ | ---------------------------------------------------- |
| `minimal` | 3         | 2       | 10       | 5      | Tests and quick checks                               |
| `demo`    | 300       | 30      | 1,200    | 6,000  | The live demo                                        |
| `load`    | 3,000     | 300     | 12,000   | 60,000 | Local load tests only: too big for the free database |

`--dry-run` prints the rows per table and an estimated size. The estimate is the rows' JSON size times `SIZE_OVERHEAD` in `src/reset.ts`, which allows for Postgres row headers and indexes.
