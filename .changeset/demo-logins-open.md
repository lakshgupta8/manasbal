---
"@manasbal/api": minor
"@manasbal/types": minor
"@manasbal/seed": patch
---

Keeps the demo logins open for everyone: wrong passwords never lock them (the rate limit still applies) and two-step set-up answers 403 for them. Their emails move to `DEMO_EMAILS` in `@manasbal/types`, with `isDemoEmail`, shared by the API and the seed.
