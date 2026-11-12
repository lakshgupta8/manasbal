# @manasbal/types

## 0.6.0

### Minor Changes

- 85a4a59: Keeps the demo logins open for everyone: wrong passwords never lock them (the rate limit still applies) and two-step set-up answers 403 for them. Their emails move to `DEMO_EMAILS` in `@manasbal/types`, with `isDemoEmail`, shared by the API and the seed.

### Patch Changes

- 79cce7c: The shop has a sign-in page (`/en/sign-in`, `/hi/sign-in`) with one-click demo logins, errors in words next to the right field, and an alert with the wait after too many tries. The access token stays in memory; a reload renews the session from the refresh cookie, and the header shows who is signed in with a **Sign out** button. `@manasbal/types` exports `@manasbal/types/demo-logins` on its own, `@manasbal/seed` exports `@manasbal/seed/demo-logins`, and `@manasbal/ui` and `@manasbal/icons` say which of their files have side effects, so unused components and icons stay out of the shop's bundle.
- c4c3a1b: The shop has a sign-up page (`/en/sign-up`) with an unticked 18+ box and a "use made-up details" note, and a confirm-email page (`/en/verify-email?token=...`). With mail off sign-up goes straight to sign-in; with mail on it says "Check your email". `POST /auth/sign-up` now answers `emailConfirmed`, so the shop knows which. The shop's error page reads its words from its own small file, and the browser's auth calls use `fetch` directly, which keeps the shop's client JS under its 200 kB budget.
- 8084d80: Every wrong two-step code counts: wrong codes on `POST /auth/2fa/enable` and `/auth/2fa/disable` now count against the account's lockout (5 lock its codes for 15 minutes, 429) and are audited as `auth.2fa.failed`, as at sign-in. Each sign-in challenge allows at most 5 wrong codes, then answers "Sign in again". The API types list the new 429 answers.

## 0.5.0

### Minor Changes

- 94d943c: Sign-in locks an email for 15 minutes after 5 wrong passwords (and the second step after 5 wrong codes); the refresh cookie routes only accept the shop's origins (WEB_ORIGINS); every auth event is audited without emails or passwords, so an audit entry's target can now be null.
- 9259e7c: Sellers can rename their store (PATCH /me/store); support and admin can view any order (GET /admin/orders/:id), and each view is audited.
- 312620d: Five roles (customer, seller, seller_staff, support, admin); new accounts are customers; admin endpoints check the role in the access token.
- e93f956: Users can list where they are signed in (GET /me/sessions) and end any session (DELETE /me/sessions/:id).
- fc99e14: Signed-in users can switch on two-step sign-in with an authenticator app (POST /auth/2fa/setup, POST /auth/2fa/enable) and get 10 recovery codes once; the secret is stored encrypted.
- 307a2ba: Sign-in asks for the authenticator-app code (or a recovery code) when two-step sign-in is on; each code works once, and two-step can be switched off with a code.

## 0.4.0

### Minor Changes

- eba2739: Protected endpoints take an access token (Authorization: Bearer); the x-demo-user header is gone; GET /me answers the signed-in user.
- b5c7e2b: New accounts confirm their email address (POST /auth/verify-email); sign-in refuses unconfirmed accounts.
- 1dc77f0: Forgotten passwords can be reset by email (POST /auth/forgot-password, POST /auth/reset-password); a reset ends every session.
- 7775290: Users can sign in with `POST /auth/sign-in`: it answers a 15-minute access token and sets an httpOnly refresh cookie.
- 668aa20: Visitors can create an account with `POST /auth/sign-up`.

## 0.3.0

### Minor Changes

- 217df11: Reviews say whether they are samples.

## 0.2.0

### Minor Changes

- 523f076: Addresses no longer have a phone number: it is not stored, accepted or returned.
- f0d897e: Adds DEMO- checks for PAN, GSTIN and bank account numbers, so only fake ones are accepted.

### Patch Changes

- 529247b: Describe every API endpoint and lint the API description with Spectral in CI.

## 0.1.0

### Minor Changes

- e33cb81: A user can list, add, edit and delete their own delivery addresses at /me/addresses. Another user's address answers 404. Until sign-in exists, the user is named in an x-demo-user header outside production; in production these endpoints answer 401. The address form's checks (6-digit PIN code, 10-digit mobile number) are Zod schemas in @manasbal/types, for the shop to reuse.

### Patch Changes

- 0f1834b: Upgrade Zod to 4.6.7, which fixes CVE-2023-54404 (denial of service when validating a very large array).
