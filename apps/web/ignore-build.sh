#!/bin/bash
# Vercel "Ignored Build Step": exit 0 skips the build, exit 1 runs it. Previews are built only
# when a change can affect the storefront; anything unclear builds (fail-safe).
# Only `dev` builds (see git.deploymentEnabled in vercel.json), and only while a dev -> main PR is
# open, which is when Vercel sets the PR id; a push to `dev` with no open PR is skipped.
# Paths are relative to this app's root directory (apps/web).
if [ "${VERCEL_GIT_COMMIT_REF:-}" = "dev" ] && [ -z "${VERCEL_GIT_PULL_REQUEST_ID:-}" ]; then
  exit 0
fi

PATHS=(. ../../packages/tsconfig ../../packages/ui ../../package.json ../../pnpm-lock.yaml ../../pnpm-workspace.yaml ../../turbo.json)

# Compare with the last built commit on this branch; a new branch has none, so compare with dev.
BASE="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$BASE" ]; then
  git fetch --quiet --depth=1 origin dev || exit 1
  BASE=FETCH_HEAD
fi

git diff --quiet "$BASE" HEAD -- "${PATHS[@]}"
