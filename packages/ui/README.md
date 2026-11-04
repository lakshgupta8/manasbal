# @manasbal/ui

The Manasbal design system: shared React components, documented and tested in Storybook.

```bash
pnpm --filter @manasbal/ui dev            # Storybook on http://localhost:6006
pnpm --filter @manasbal/ui test:visual    # screenshot + accessibility check of every story (needs Docker)
```

Visual tests always render in the Linux browser of the Playwright Docker image, so a baseline taken on any machine matches CI. After an intended visual change, refresh the baselines with `pnpm --filter @manasbal/ui test:visual --update-snapshots` and commit them with the change.

## Design tokens

The tokens live in `tokens/*.json` (DTCG format). `semantic.json` is the meaning layer: names that say what a colour is for, with a light value and a dark one (`$extensions.manasbal.dark`). After changing a token, regenerate the theme and commit it with the change:

```bash
pnpm --filter @manasbal/ui tokens   # writes src/theme.css; a test fails while it is out of date
```

Storybook shows every token on **Foundations/Tokens**, read from the same JSON files, so the page always matches the code.

Apps load it with `@import "@manasbal/ui/theme.css";` after `@import "tailwindcss";`. It gives CSS variables (`--mb-color-brand-primary`) and Tailwind classes (`bg-lake-600`, `text-text-muted`, `p-4`, `text-heading-1`, `rounded-md`).
