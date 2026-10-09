# 0004: NestJS on Fastify for the API

- **Status:** Accepted
- **Date:** 2026-10-10

## Context

The API needs modules, dependency injection, guards for role-based access and generated OpenAPI documentation. It runs as a long-lived Node process (WebSockets and background jobs later), so serverless hosting doesn't fit.

## Decision

NestJS with the Fastify adapter. Vitest for unit and end-to-end tests (e2e tests use Fastify's built-in request injection, so no HTTP client library is needed). ESLint with type-aware `typescript-eslint` rules, matching the other apps instead of the generator's default oxlint.

## Consequences

- Fastify is faster than Express and has first-class request injection for tests.
- Some Express-only Nest middleware can't be used; Fastify equivalents exist for what's planned.
- The generator's paid hosting CLI (`@nestjs/mau`) was removed; deploys go through our own pipeline.
