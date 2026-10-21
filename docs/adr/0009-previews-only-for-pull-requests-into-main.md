# 0009: Previews only for pull requests into main

- **Status:** Accepted
- **Date:** 2026-10-21
- **Amends:** [0006](0006-ci-cd-pipeline.md), the "Previews" line for Vercel and Netlify, and [0008](0008-vercel-previews-only-for-storefront-changes.md)

## Context

Every PR into `dev` built a Vercel preview, and every PR built a Netlify preview, although most pull requests change only one app. Vercel Hobby limits deployments, and previews of work that is only on its way into `dev` are not reviewed by anyone. The week's work is looked at once, on the `dev` → `main` PR. Production is unaffected: it still deploys only from the release workflow.

## Decision

- Previews exist only for pull requests into `main`, normally the weekly `dev` → `main` PR.
- **Vercel:** only the `dev` branch builds (`git.deploymentEnabled` in `apps/web/vercel.json`), so feature PRs into `dev` get no preview. `apps/web/ignore-build.sh` skips a `dev` build while no PR is open, using the empty `VERCEL_GIT_PULL_REQUEST_ID`, and keeps the changed-paths check from 0008. A PR straight into `main` gets no Vercel preview, because Vercel does not expose a PR's target branch.
- **Netlify:** the Deploy Previews setting is "Any pull request against your production branch / branch deploy branches", so PRs into `dev` get none. `apps/console/ignore-build.sh` builds a preview only when a change can affect the console, the same way as 0008 does for the storefront.
- Render has no previews and no auto-deploy; it is unchanged.
- Production deploys are unchanged: only a merged release PR deploys, through `deploy.yml`.

## Consequences

- Far fewer Vercel and Netlify builds. Preview builds cost no Netlify credits, but they use build time.
- A storefront or console change is first seen on a preview at the weekly `dev` → `main` PR, not on its own PR. Run it locally or in Storybook before merging into `dev`.
- The `dev` skip relies on Vercel setting the PR id for a branch with an open PR. This was checked on a throwaway PR (empty with no PR, set with one).
- The scripts run only on Vercel and Netlify, so a wrongly skipped preview shows up as a missing check on the PR.
