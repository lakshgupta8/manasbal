# 0008: Vercel previews only for changes that affect the storefront

- **Status:** Accepted
- **Date:** 2026-10-19
- **Amends:** [0006](0006-ci-cd-pipeline.md), the "Previews" line for Vercel

## Context

Record 0006 says Vercel builds a preview per PR. Vercel Hobby limits deployments, and most pull requests so far change only the API, tooling or docs, so their previews build a storefront nobody opens. Production is unaffected: it deploys only from the release workflow.

## Decision

- A Vercel preview builds only when a change can affect the storefront: `apps/web`, `packages/ui`, `packages/tsconfig`, or the root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` or `turbo.json`. Every other change skips the build.
- This is Vercel's Ignored Build Step, set by `ignoreCommand` in `apps/web/vercel.json` and implemented in `apps/web/ignore-build.sh`. It compares with the last built commit on the branch, or with `dev` on a new branch.
- It fails safe: if the comparison cannot run, the preview builds.
- `packages/ui` is on the list ahead of the storefront importing it, so adopting it needs no change here. New workspace packages that the storefront imports must be added to the list.

## Consequences

- Fewer deployments used, with no effect on production or on the other CI checks, which still run on every PR.
- A dependency change for any app updates the shared lockfile and still builds a preview; this is the price of not missing a storefront install change.
- The script runs only on Vercel, so a wrongly skipped preview shows up as a missing Vercel check on a storefront PR.
