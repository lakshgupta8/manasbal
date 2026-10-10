# @manasbal/ui

The Manasbal design system: shared React components, documented and tested in Storybook.

```bash
pnpm --filter @manasbal/ui dev            # Storybook on http://localhost:6006
pnpm --filter @manasbal/ui test:visual    # screenshot + accessibility check of every story (needs Docker)
```

Visual tests always render in the Linux browser of the Playwright Docker image, so a baseline taken on any machine matches CI. After an intended visual change, refresh the baselines with `pnpm --filter @manasbal/ui test:visual --update-snapshots` and commit them with the change.
