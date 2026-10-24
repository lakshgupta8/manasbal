# @manasbal/types

## 0.1.0

### Minor Changes

- e33cb81: A user can list, add, edit and delete their own delivery addresses at /me/addresses. Another user's address answers 404. Until sign-in exists, the user is named in an x-demo-user header outside production; in production these endpoints answer 401. The address form's checks (6-digit PIN code, 10-digit mobile number) are Zod schemas in @manasbal/types, for the shop to reuse.

### Patch Changes

- 0f1834b: Upgrade Zod to 4.6.7, which fixes CVE-2023-54404 (denial of service when validating a very large array).
