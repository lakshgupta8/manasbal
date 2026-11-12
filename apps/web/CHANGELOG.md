# @manasbal/web

## 0.2.0

### Minor Changes

- 2e7da4a: The shop speaks English and Hindi: every page lives under `/en` or `/hi`, with a link in the header to the other language. The Hindi is a draft until a native speaker reads it, and the footer says so. `DemoBanner`, `Header`, `Footer` and `Notice` take their words as props, with today's English as the default.
- 901a0f6: The shop reaches the API through its own address (`/auth/*` and `/api/*`), so the sign-in cookie stays first-party. Pages load data through one helper with a timeout and typed errors, and every page has loading, error and not-found screens.
- 79cce7c: The shop has a sign-in page (`/en/sign-in`, `/hi/sign-in`) with one-click demo logins, errors in words next to the right field, and an alert with the wait after too many tries. The access token stays in memory; a reload renews the session from the refresh cookie, and the header shows who is signed in with a **Sign out** button. `@manasbal/types` exports `@manasbal/types/demo-logins` on its own, `@manasbal/seed` exports `@manasbal/seed/demo-logins`, and `@manasbal/ui` and `@manasbal/icons` say which of their files have side effects, so unused components and icons stay out of the shop's bundle.
- c4c3a1b: The shop has a sign-up page (`/en/sign-up`) with an unticked 18+ box and a "use made-up details" note, and a confirm-email page (`/en/verify-email?token=...`). With mail off sign-up goes straight to sign-in; with mail on it says "Check your email". `POST /auth/sign-up` now answers `emailConfirmed`, so the shop knows which. The shop's error page reads its words from its own small file, and the browser's auth calls use `fetch` directly, which keeps the shop's client JS under its 200 kB budget.
- 647ce9a: Signing in with two-step sign-in on now asks for the 6-digit code from the authenticator app, or a recovery code, in the same card. New pages: `/en/forgot-password`, which always answers "If this email has an account, a link is on its way", and `/en/reset-password?token=...`, which sets a new password with the sign-up rule and then says "Sign in with your new password".

### Patch Changes

- 2a80080: The Hindi has been read by a native speaker, so Hindi pages no longer say in the footer that it is a draft.
- bcbd527: Every page now has the same frame: a "Skip to main content" link, the demo banner, the header, the page and a footer linking the source code.
- Updated dependencies [85a4a59]
- Updated dependencies [2e7da4a]
- Updated dependencies [13164d9]
- Updated dependencies [bcbd527]
- Updated dependencies [69063b4]
- Updated dependencies [79cce7c]
- Updated dependencies [c4c3a1b]
- Updated dependencies [8084d80]
  - @manasbal/types@0.6.0
  - @manasbal/seed@0.1.1
  - @manasbal/ui@0.1.0
  - @manasbal/icons@0.0.2
  - @manasbal/sdk@0.2.2

## 0.1.4

### Patch Changes

- 3a02150: Builds the theme from the design tokens: `@manasbal/ui/theme.css` holds every token as a CSS variable, a meaning layer (text, surface, border, brand) for light and dark, and a Tailwind theme. The storefront and the demo banner take their colours from it.
- Updated dependencies [693a9c3]
- Updated dependencies [e93f956]
- Updated dependencies [9e11a89]
- Updated dependencies [3a02150]
- Updated dependencies [9f6c0dc]
- Updated dependencies [fc99e14]
- Updated dependencies [307a2ba]
  - @manasbal/ui@0.0.3
  - @manasbal/sdk@0.2.1

## 0.1.3

### Patch Changes

- 5bc3b06: Add the `Notice` component to `@manasbal/ui`, and use it for the "Categories are unavailable right now" message on the home page.
- Updated dependencies [7b330ec]
- Updated dependencies [5bc3b06]
- Updated dependencies [90c1077]
  - @manasbal/ui@0.0.2
  - @manasbal/sdk@0.2.0

## 0.1.2

### Patch Changes

- @manasbal/sdk@0.1.2

## 0.1.1

### Patch Changes

- @manasbal/sdk@0.1.1

## 0.1.0

### Minor Changes

- 474a844: Home page lists the main categories from the API

### Patch Changes

- 82c9389: Upgrade Next.js to 16.4.1, which fixes two remote code execution flaws (image optimization of SVG files, and `use cache` functions) and a denial of service through Server Actions.
- Updated dependencies [f85c13d]
  - @manasbal/sdk@0.1.0
