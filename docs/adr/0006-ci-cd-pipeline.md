# 0006: CI/CD on GitHub Actions, production deploys only on release

- **Status:** Accepted
- **Date:** 2026-10-10

## Context

Everything must run on free tiers. Netlify Free charges 15 of its 300 monthly credits per production deploy, Render's free instances sleep and build slowly, and Vercel Hobby limits deployments. Deploying every merge to `main` would burn through those limits. The pipeline also has to enforce the project's legal guardrails (no real brands, secrets, ID numbers or copyleft licences) as hard checks, not reminders.

## Decision

- **Every PR and push to `main`** runs lint, typecheck, unit tests with a 60% coverage floor, builds (Turborepo-cached), API end-to-end tests, the brand and licence guardrails, bundle budgets (`size-limit`), Lighthouse CI, gitleaks (with Aadhaar and PAN rules), Trivy, `pnpm audit` on production dependencies, CodeQL (code and workflows) and SonarQube Cloud.
- **Previews:** Vercel and Netlify build a preview per PR; Neon creates a **schema-only** database branch per PR, so a preview never holds a copy of the demo database.
- **Releases:** Changesets. Merging the "chore: release" PR tags each changed app; **only those apps deploy**, through `deploy.yml`.
- **Deploys:** deploy → smoke test → automatic rollback. The API ships as a Trivy-scanned image on GHCR; `/health` reports the image's commit so the smoke test can tell the new version from the old one. A passing image is tagged `stable`, the rollback target.
- Every third-party action is pinned to a commit SHA; Renovate keeps the pins current.
- Integrations that need accounts (Codecov, SonarQube, Neon, deploys) switch on through repository secrets and variables, so the workflows run green before go-live.

## Consequences

- Production changes only when a release is cut, which keeps every free tier inside its limits and gives each deploy a changelog entry.
- The release PR is opened with `GITHUB_TOKEN`, so CI doesn't run on that PR itself; its contents are version bumps and changelogs already verified on `main`.
- `pnpm audit` blocks only on production dependencies. Dev-tool advisories (some with no fix) are reported without blocking.
- Storybook visual regression joins in Phase 6, when Storybook exists.
