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

## A brand-new database

A new database has no `_demo_marker` row, so the reset refuses. Bring it up to date and seed it once, then reset works from then on:

```sh
pnpm --filter @manasbal/api exec prisma db migrate
pnpm --filter @manasbal/seed seed --profile demo
```

`seed` only inserts: on a database that already has the seed's rows it fails on duplicate keys. Use `seed:reset` for that.

## Profiles

| Profile   | Customers | Sellers | Products | Orders | Where                                                |
| --------- | --------- | ------- | -------- | ------ | ---------------------------------------------------- |
| `minimal` | 3         | 2       | 10       | 5      | Tests and quick checks                               |
| `demo`    | 300       | 30      | 1,200    | 6,000  | The live demo                                        |
| `load`    | 3,000     | 300     | 12,000   | 60,000 | Local load tests only: too big for the free database |

`--dry-run` prints the rows per table and an estimated size. The estimate is the rows' JSON size times `SIZE_OVERHEAD` in `src/reset.ts`, which allows for Postgres row headers and indexes.
