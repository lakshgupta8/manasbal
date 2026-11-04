---
"@manasbal/web": minor
---

The shop reaches the API through its own address (`/auth/*` and `/api/*`), so the sign-in cookie stays first-party. Pages load data through one helper with a timeout and typed errors, and every page has loading, error and not-found screens.
