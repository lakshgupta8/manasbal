# @manasbal/ui

## 0.1.0

### Minor Changes

- 2e7da4a: The shop speaks English and Hindi: every page lives under `/en` or `/hi`, with a link in the header to the other language. The Hindi is a draft until a native speaker reads it, and the footer says so. `DemoBanner`, `Header`, `Footer` and `Notice` take their words as props, with today's English as the default.
- 13164d9: Adds the `Button` (primary, secondary and ghost; md and sm; optional icon), `TextField` (label, "(required)", hint, error, and a password version with a show button) and `Checkbox` (never ticked unless the caller says so; error row) components, themed by tokens only. New meaning-layer colours for focus rings, hover, disabled controls and errors (`color.feedback.error`, `color.feedback.error-border`), with their contrast pairs checked, and `data-theme="dark"` / `data-theme="light"` blocks in `theme.css`, so part of a page can use either theme whatever the system setting.
- bcbd527: Adds `Header` (the logo, a list of links, and slots for the language switch, account and cart) and `Footer` (a list of links and a line of small print).
- 69063b4: Adds the `Rating` component (five stars from the star and half-star icons for any value from 0 to 5 in halves, the value in words for assistive tech, an optional review count as text; any other value throws a `RangeError`) and the `Price` component (rupees with Indian grouping from whole paise, large and small; anything but a safe, non-negative whole number of paise throws a `TypeError`; screen readers hear "1,29,999 rupees"), plus `formatPaise`. `SampleBadge` gains `kind="item"` ("Sample", for product pictures and data) and a `label` prop for the page's language; its text moves to the small type step (14/20) and its colours to theme tokens.

### Patch Changes

- 79cce7c: The shop has a sign-in page (`/en/sign-in`, `/hi/sign-in`) with one-click demo logins, errors in words next to the right field, and an alert with the wait after too many tries. The access token stays in memory; a reload renews the session from the refresh cookie, and the header shows who is signed in with a **Sign out** button. `@manasbal/types` exports `@manasbal/types/demo-logins` on its own, `@manasbal/seed` exports `@manasbal/seed/demo-logins`, and `@manasbal/ui` and `@manasbal/icons` say which of their files have side effects, so unused components and icons stay out of the shop's bundle.
- Updated dependencies [79cce7c]
  - @manasbal/icons@0.0.2

## 0.0.3

### Patch Changes

- 693a9c3: Adds the colour tokens.
- 9e11a89: Adds the spacing, type and corner radius tokens.
- 3a02150: Builds the theme from the design tokens: `@manasbal/ui/theme.css` holds every token as a CSS variable, a meaning layer (text, surface, border, brand) for light and dark, and a Tailwind theme. The storefront and the demo banner take their colours from it.
- 9f6c0dc: Adds the Foundations/Tokens page in Storybook: every colour (with the light and dark meaning layer), spacing step, type size and weight, and radius, read from the token files.

## 0.0.2

### Patch Changes

- 7b330ec: Info and warning notices span the full width, like error notices.
- 5bc3b06: Add the `Notice` component to `@manasbal/ui`, and use it for the "Categories are unavailable right now" message on the home page.

## 0.0.1

### Patch Changes

- d810612: Adds the Sample review badge.
