# @manasbal/api

## 0.8.0

### Minor Changes

- 85a4a59: Keeps the demo logins open for everyone: wrong passwords never lock them (the rate limit still applies) and two-step set-up answers 403 for them. Their emails move to `DEMO_EMAILS` in `@manasbal/types`, with `isDemoEmail`, shared by the API and the seed.
- c4c3a1b: The shop has a sign-up page (`/en/sign-up`) with an unticked 18+ box and a "use made-up details" note, and a confirm-email page (`/en/verify-email?token=...`). With mail off sign-up goes straight to sign-in; with mail on it says "Check your email". `POST /auth/sign-up` now answers `emailConfirmed`, so the shop knows which. The shop's error page reads its words from its own small file, and the browser's auth calls use `fetch` directly, which keeps the shop's client JS under its 200 kB budget.
- 8084d80: Every wrong two-step code counts: wrong codes on `POST /auth/2fa/enable` and `/auth/2fa/disable` now count against the account's lockout (5 lock its codes for 15 minutes, 429) and are audited as `auth.2fa.failed`, as at sign-in. Each sign-in challenge allows at most 5 wrong codes, then answers "Sign in again". The API types list the new 429 answers.

### Patch Changes

- 75b3ef3: The CORS settings move into `corsOptions` (same behaviour), so tests can check them; the threat model's rate-limit, token-algorithm and CORS rows now name their tests.
- 8e03988: Counts each visitor by their own address behind a proxy: `TRUSTED_PROXY_HOPS` says how many proxies to trust in `X-Forwarded-For` (0, the default, ignores it).
- Updated dependencies [85a4a59]
- Updated dependencies [79cce7c]
- Updated dependencies [c4c3a1b]
- Updated dependencies [8084d80]
  - @manasbal/types@0.6.0

## 0.7.0

### Minor Changes

- 94d943c: Sign-in locks an email for 15 minutes after 5 wrong passwords (and the second step after 5 wrong codes); the refresh cookie routes only accept the shop's origins (WEB_ORIGINS); every auth event is audited without emails or passwords, so an audit entry's target can now be null.
- 9259e7c: Sellers can rename their store (PATCH /me/store); support and admin can view any order (GET /admin/orders/:id), and each view is audited.
- 312620d: Five roles (customer, seller, seller_staff, support, admin); new accounts are customers; admin endpoints check the role in the access token.
- e93f956: Users can list where they are signed in (GET /me/sessions) and end any session (DELETE /me/sessions/:id).
- fc99e14: Signed-in users can switch on two-step sign-in with an authenticator app (POST /auth/2fa/setup, POST /auth/2fa/enable) and get 10 recovery codes once; the secret is stored encrypted.
- 307a2ba: Sign-in asks for the authenticator-app code (or a recovery code) when two-step sign-in is on; each code works once, and two-step can be switched off with a code.

### Patch Changes

- Updated dependencies [94d943c]
- Updated dependencies [9259e7c]
- Updated dependencies [312620d]
- Updated dependencies [e93f956]
- Updated dependencies [fc99e14]
- Updated dependencies [307a2ba]
  - @manasbal/types@0.5.0

## 0.6.0

### Minor Changes

- eba2739: Protected endpoints take an access token (Authorization: Bearer); the x-demo-user header is gone; GET /me answers the signed-in user.
- b5c7e2b: New accounts confirm their email address (POST /auth/verify-email); sign-in refuses unconfirmed accounts.
- 1dc77f0: Forgotten passwords can be reset by email (POST /auth/forgot-password, POST /auth/reset-password); a reset ends every session.
- 3268ac6: `POST /auth/refresh` renews the access token and rotates the refresh cookie; reusing an old cookie signs out every copy. `POST /auth/sign-out` ends the session.
- 7775290: Users can sign in with `POST /auth/sign-in`: it answers a 15-minute access token and sets an httpOnly refresh cookie.
- 668aa20: Visitors can create an account with `POST /auth/sign-up`.

### Patch Changes

- Updated dependencies [eba2739]
- Updated dependencies [b5c7e2b]
- Updated dependencies [1dc77f0]
- Updated dependencies [7775290]
- Updated dependencies [668aa20]
  - @manasbal/types@0.4.0

## 0.5.0

### Minor Changes

- 217df11: Reviews say whether they are samples.

### Patch Changes

- Updated dependencies [217df11]
  - @manasbal/types@0.3.0

## 0.4.0

### Minor Changes

- 523f076: Addresses no longer have a phone number: it is not stored, accepted or returned.

### Patch Changes

- 813c8af: Adds the shipments and settlements tables, so the demo data can hold deliveries and sellers' monthly payouts.
- 529247b: Describe every API endpoint and lint the API description with Spectral in CI.
- Updated dependencies [529247b]
- Updated dependencies [523f076]
- Updated dependencies [f0d897e]
  - @manasbal/types@0.2.0

## 0.3.0

### Minor Changes

- 3614471: Address changes are written to the audit log; GET /admin/audit-log lists it for admins.
- 59cc579: First versions of GET /cart, POST /cart/items and GET /orders.
- daca698: Lists categories as a tree.
- 8855a74: Shows stock per variant for a product.
- be0692a: Lists products page by page.
- b7df3f4: GET /sellers/:slug and GET /products/:slug/reviews
- 9d13564: GET /products/:slug answers one product with its category, seller and variants with stock.
- b7df3f4: Add GET /products/:slug/reviews, a product's reviews newest first, one page at a time.
- b7df3f4: Add GET /sellers/:slug, a store's public page with its product count. Only approved stores are shown.
- 8855a74: Add GET /products/:id/stock, which answers how many of each variant can be bought.
- e33cb81: A user can list, add, edit and delete their own delivery addresses at /me/addresses. Another user's address answers 404. Until sign-in exists, the user is named in an x-demo-user header outside production; in production these endpoints answer 401. The address form's checks (6-digit PIN code, 10-digit mobile number) are Zod schemas in @manasbal/types, for the shop to reuse.

### Patch Changes

- 1dd6e72: Mark demo rows with is_sample / created_by_visitor on every table visitors can write to
- f85c13d: The x-demo-user header is optional in the API description, so the client's demoUser option can set it
- 0f1834b: The API image runs on Node.js 24.22.1, the October 2026 security release.
- 0f1834b: Upgrade Zod to 4.6.7, which fixes CVE-2023-54404 (denial of service when validating a very large array).
- Updated dependencies [e33cb81]
- Updated dependencies [0f1834b]
  - @manasbal/types@0.1.0

## 0.2.0

### Minor Changes

- 42094d6: Rate limit the API to 100 requests a minute per visitor, counted in Valkey. Requests over the limit get a 429 problem+json response with a Retry-After header. /health is not limited. If Valkey is unreachable, requests are let through.
- The API describes itself at /docs (and as OpenAPI JSON at /docs-json), and every error comes back as application/problem+json.
- 0fd4dda: Requests that change something can carry an Idempotency-Key header. A repeat with the same key within 24 hours gets the first answer back (marked Idempotent-Replayed: true) instead of doing the work twice.

## 0.1.0

### Minor Changes

- 7602279: `/health` now reports the deployed version, so a deploy can confirm the new build is live.
