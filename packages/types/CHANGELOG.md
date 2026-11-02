# @manasbal/types

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
