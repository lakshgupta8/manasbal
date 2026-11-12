# @manasbal/icons

## 0.0.2

### Patch Changes

- 79cce7c: The shop has a sign-in page (`/en/sign-in`, `/hi/sign-in`) with one-click demo logins, errors in words next to the right field, and an alert with the wait after too many tries. The access token stays in memory; a reload renews the session from the refresh cookie, and the header shows who is signed in with a **Sign out** button. `@manasbal/types` exports `@manasbal/types/demo-logins` on its own, `@manasbal/seed` exports `@manasbal/seed/demo-logins`, and `@manasbal/ui` and `@manasbal/icons` say which of their files have side effects, so unused components and icons stay out of the shop's bundle.

## 0.0.1

### Patch Changes

- 7c5c748: Adds the Foundations/Icons gallery in Storybook (filter by name, sizes 16, 20 and 24), an `iconList` export, and 16 more icons: chevrons, arrows, truck, package, map-pin, clock, return, card, wallet, bank, lock and eye.
- 2eb3f21: Builds a React component for every icon (size 16, 20 or 24; decorative unless it has a title) and adds 6 more icons: minus, trash, edit, check, alert and info.
- 7bad995: Adds the first 12 icons.
- 2cc49f1: Completes the first set of 40 icons.
