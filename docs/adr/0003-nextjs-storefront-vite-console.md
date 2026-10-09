# 0003: Next.js storefront, Vite console

- **Status:** Accepted
- **Date:** 2026-10-10

## Context

The storefront is public and benefits from server rendering (SEO, fast first load). The seller and admin console sits behind a login and doesn't need SEO. Free hosting tiers charge differently for server functions and static files.

## Decision

- **Storefront (`apps/web`):** Next.js with the App Router, hosted on Vercel's free plan.
- **Console (`apps/console`):** a Vite + React single-page app served as static files, hosted on Netlify's free plan.
- Both enable the React Compiler.

## Consequences

- The console uses no serverless function quota at all.
- Two frontend toolchains to maintain; shared UI goes into a common package so components aren't duplicated.
- The console sends `noindex`, since it should never appear in search results.
