---
"@manasbal/api": minor
"@manasbal/types": minor
"@manasbal/sdk": patch
---

Signed-in users can switch on two-step sign-in with an authenticator app (POST /auth/2fa/setup, POST /auth/2fa/enable) and get 10 recovery codes once; the secret is stored encrypted.
