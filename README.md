<div align="center">

<img src="brand/manasbal-logo.svg" alt="Manasbal" width="320">

**A demo multi-vendor marketplace, built and run like a real product, at zero cost.**

[![CI](https://github.com/lakshgupta8/manasbal/actions/workflows/ci.yml/badge.svg)](https://github.com/lakshgupta8/manasbal/actions/workflows/ci.yml)
[![CodeQL](https://github.com/lakshgupta8/manasbal/actions/workflows/codeql.yml/badge.svg)](https://github.com/lakshgupta8/manasbal/actions/workflows/codeql.yml)
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

| App                                      | What it is                        | Stack                              |
| ---------------------------------------- | --------------------------------- | ---------------------------------- |
| [`apps/web`](apps/web)                   | Storefront                        | Next.js (App Router), Tailwind CSS |
| [`apps/console`](apps/console)           | Seller and admin console          | Vite + React single-page app       |
| [`apps/api`](apps/api)                   | REST API                          | NestJS on Fastify                  |
| [`packages/tsconfig`](packages/tsconfig) | Shared strict TypeScript settings | —                                  |

## Getting started

Requires **Node.js 24 LTS** (see [`.nvmrc`](.nvmrc)) and **pnpm 10**.

```bash
pnpm install
pnpm dev          # all apps in parallel
```

| Command          | Runs                     |
| ---------------- | ------------------------ |
| `pnpm dev`       | Every app in watch mode  |
| `pnpm build`     | Production builds        |
| `pnpm lint`      | ESLint in every app      |
| `pnpm typecheck` | TypeScript in every app  |
| `pnpm test`      | Unit tests               |
| `pnpm format`    | Prettier across the repo |

## Documentation

- [Architecture decisions](docs/adr)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

## License

Copyright © 2026 Lakshya Gupta. Licensed under the [Apache License 2.0](LICENSE); keep the [NOTICE](NOTICE) file in copies. The licence covers the code and assets but not the name **Manasbal** or the lotus logo as trademarks (section 6), so forks need their own name and logo.
