<div align="center">

<img src="brand/manasbal-logo.svg" alt="Manasbal" width="320">

**A demo multi-vendor marketplace, built and run like a real product, at zero cost.**

[![CI](https://github.com/lakshgupta8/manasbal/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/lakshgupta8/manasbal/actions/workflows/ci.yml)
[![CodeQL](https://github.com/lakshgupta8/manasbal/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/lakshgupta8/manasbal/actions/workflows/codeql.yml)
[![Quality gate](https://sonarcloud.io/api/project_badges/measure?project=lakshgupta8_manasbal&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=lakshgupta8_manasbal)
[![Coverage](https://codecov.io/gh/lakshgupta8/manasbal/graph/badge.svg)](https://codecov.io/gh/lakshgupta8/manasbal)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A524-339933)
![pnpm](https://img.shields.io/badge/pnpm-10-F69220)

</div>

> [!NOTE]
> **This is a portfolio project, not a real shop.** Nothing is for sale; payments and delivery are simulated.

The name comes from [Manasbal Lake](https://en.wikipedia.org/wiki/Manasbal_Lake) in Kashmir, often called the _supreme gem of all Kashmir lakes_: quieter and lesser known than Dal Lake, and famous for its summer lotus bloom.

## Apps

| App                                      | What it is                        | Stack                                    |
| ---------------------------------------- | --------------------------------- | ---------------------------------------- |
| [`apps/web`](apps/web)                   | Storefront                        | Next.js (App Router), Tailwind CSS       |
| [`apps/console`](apps/console)           | Seller and admin console          | Vite + React single-page app             |
| [`apps/api`](apps/api)                   | REST API                          | NestJS on Fastify                        |
| [`packages/ui`](packages/ui)             | Design system                     | React components documented in Storybook |
| [`packages/tsconfig`](packages/tsconfig) | Shared strict TypeScript settings | —                                        |

## Getting started

Requires **Node.js 24.22.1 or later** (the October 2026 security release, see [`.nvmrc`](.nvmrc)) and **pnpm 10**.

```bash
pnpm install
pnpm dev          # all apps in parallel
```

| Command            | Runs                                                          |
| ------------------ | ------------------------------------------------------------- |
| `pnpm dev`         | Every app in watch mode, plus Storybook                       |
| `pnpm build`       | Production builds                                             |
| `pnpm lint`        | ESLint in every app                                           |
| `pnpm typecheck`   | TypeScript in every app                                       |
| `pnpm test`        | Unit tests                                                    |
| `pnpm test:e2e`    | API end-to-end tests                                          |
| `pnpm test:visual` | Storybook screenshots and accessibility checks (needs Docker) |
| `pnpm format`      | Prettier across the repo                                      |

## Local databases

Needs Docker. Postgres, Valkey (Redis-compatible), Mailpit (catches emails) and Meilisearch (search) run in containers:

```bash
cp .env.example apps/api/.env   # once; Windows: copy .env.example apps\api\.env
docker compose up -d            # start
docker compose ps               # check
docker compose stop             # stop, keeping your data
docker compose down             # stop and remove the containers (the databases start empty next time)
```

| Service     | Address                                                 |
| ----------- | ------------------------------------------------------- |
| Postgres    | `localhost:5432` (user, password, database: `manasbal`) |
| Valkey      | `localhost:6379`                                        |
| Mailpit     | http://localhost:8025 (web) · `localhost:1025` (SMTP)   |
| Meilisearch | http://localhost:7700                                   |

Port 5432 must be free: stop any other Postgres running on your computer first.

## API

The API listens on http://localhost:3001 (set `PORT` to change it). Start the databases first (see above), then `pnpm dev`, or only the API with `pnpm --filter @manasbal/api dev`.

**Docs.** With the API running, open http://localhost:3001/docs for the interactive page, where you can try each endpoint. The raw OpenAPI description is at http://localhost:3001/docs-json. `pnpm --filter @manasbal/api openapi` writes the same description to a file without starting the server (run `pnpm build` first).

**Bruno collection.** The requests in [`bruno`](bruno) can be run with [Bruno](https://www.usebruno.com/):

1. Open Bruno, choose **Open Collection**, and pick the `bruno` folder.
2. Choose the **local** environment (top right). **prod** points at the hosted demo API.
3. Run one request, or the whole collection with **Run** on the collection.

The ids in [`bruno/environments/local.yml`](bruno/environments/local.yml) (`demoUser`, `adminUser`, `addressId`, `variantId` and the others) belong to rows in one database. On your own database, replace them with ids that exist there, or those requests answer 401 or 404. Requests that act as a user send the `demoUser` id in the `x-demo-user` header; the API accepts that header outside production only.

## Documentation

- [Architecture decisions](docs/adr)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

## Contributors

- [Lakshya Gupta](https://github.com/lakshgupta8): lead and maintainer; architecture, database, most of the API, CI/CD and deployment
- [Nitiksha Rawat](https://github.com/nitiksharwt): contributor; features across the API and the storefront (endpoints, pages and components), API request collections, review

## License

Copyright © 2026 Lakshya Gupta. Licensed under the [Apache License 2.0](LICENSE); keep the [NOTICE](NOTICE) file in copies. The licence covers the code and assets but not the name **Manasbal** or the lotus logo as trademarks (section 6), so forks need their own name and logo.
