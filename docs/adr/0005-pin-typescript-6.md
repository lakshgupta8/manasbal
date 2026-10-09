# 0005: Pin TypeScript 6.0 for now

- **Status:** Accepted
- **Date:** 2026-10-10

## Context

TypeScript 7 (the native Go compiler) is the latest release, but its JavaScript API changed. In October 2026, `typescript-eslint` supports TypeScript below 6.1, and the Nest CLI ships with 6.0.

## Decision

Pin TypeScript to `~6.0.3` in every package, enforced by an override in `pnpm-workspace.yaml`.

## Consequences

- Linting with type information and Nest builds keep working.
- Revisit when `typescript-eslint` and the Nest CLI support TypeScript 7; the faster compiler can then be adopted for type checking.
