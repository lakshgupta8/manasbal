#!/bin/bash
# Netlify "ignore" command: exit 0 skips the build, exit 1 runs it. Deploy previews are built
# only when a change can affect the console; anything unclear builds (fail-safe).
# Paths are relative to this app's base directory (apps/console).
PATHS=(. ../../packages/tsconfig ../../packages/ui ../../package.json ../../pnpm-lock.yaml ../../pnpm-workspace.yaml ../../turbo.json)

# Compare with the last built commit; a first build has none, so build.
[ -n "${CACHED_COMMIT_REF:-}" ] || exit 1

git diff --quiet "$CACHED_COMMIT_REF" "${COMMIT_REF:-HEAD}" -- "${PATHS[@]}"
