# 0002: Turborepo + pnpm monorepo

- **Status:** Accepted
- **Date:** 2026-10-10

## Context

Manasbal has several deployable apps (storefront, console, API, and later a payment gateway and workers) that share types, UI components and configuration.

## Decision

One repository with pnpm workspaces (`apps/*`, `packages/*`) and Turborepo for task orchestration and caching. Shared settings live in packages, starting with `@manasbal/tsconfig`.

## Consequences

- One install, one lockfile, one pull request can change an API and its clients together.
- Turborepo only rebuilds and retests what changed.
- Tooling versions must stay compatible across apps; `pnpm-workspace.yaml` overrides enforce that where needed (see 0005).
