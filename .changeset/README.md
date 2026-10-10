# Changesets

Every PR that changes what an app does adds a changeset: `pnpm changeset`, pick the app(s), pick the bump, write one line for the changelog.

On `main`, the release workflow keeps a **"chore: release"** PR open with the pending version bumps and changelogs. Merging it tags each changed app (e.g. `@manasbal/api@0.2.0`), creates its GitHub Release and deploys **only that app** to production. See [ADR 0006](../docs/adr/0006-ci-cd-pipeline.md).
