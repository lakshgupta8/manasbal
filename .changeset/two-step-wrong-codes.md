---
"@manasbal/api": minor
"@manasbal/types": patch
---

Every wrong two-step code counts: wrong codes on `POST /auth/2fa/enable` and `/auth/2fa/disable` now count against the account's lockout (5 lock its codes for 15 minutes, 429) and are audited as `auth.2fa.failed`, as at sign-in. Each sign-in challenge allows at most 5 wrong codes, then answers "Sign in again". The API types list the new 429 answers.
