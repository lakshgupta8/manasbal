# @manasbal/seed

## 0.1.1

### Patch Changes

- 85a4a59: Keeps the demo logins open for everyone: wrong passwords never lock them (the rate limit still applies) and two-step set-up answers 403 for them. Their emails move to `DEMO_EMAILS` in `@manasbal/types`, with `isDemoEmail`, shared by the API and the seed.
- 79cce7c: The shop has a sign-in page (`/en/sign-in`, `/hi/sign-in`) with one-click demo logins, errors in words next to the right field, and an alert with the wait after too many tries. The access token stays in memory; a reload renews the session from the refresh cookie, and the header shows who is signed in with a **Sign out** button. `@manasbal/types` exports `@manasbal/types/demo-logins` on its own, `@manasbal/seed` exports `@manasbal/seed/demo-logins`, and `@manasbal/ui` and `@manasbal/icons` say which of their files have side effects, so unused components and icons stay out of the shop's bundle.
- Updated dependencies [85a4a59]
- Updated dependencies [79cce7c]
- Updated dependencies [c4c3a1b]
- Updated dependencies [8084d80]
  - @manasbal/types@0.6.0

## 0.1.0

### Minor Changes

- 312620d: Five roles (customer, seller, seller_staff, support, admin); new accounts are customers; admin endpoints check the role in the access token.

### Patch Changes

- bb81826: The seed makes slugs with the shared slugify from @manasbal/types, the same rule as store renames in the API; its seed and seed:reset scripts build that package first.
- Updated dependencies [94d943c]
- Updated dependencies [9259e7c]
- Updated dependencies [312620d]
- Updated dependencies [e93f956]
- Updated dependencies [fc99e14]
- Updated dependencies [307a2ba]
  - @manasbal/types@0.5.0
