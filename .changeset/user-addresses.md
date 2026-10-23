---
"@manasbal/api": minor
"@manasbal/types": minor
---

A user can list, add, edit and delete their own delivery addresses at /me/addresses. Another user's address answers 404. Until sign-in exists, the user is named in an x-demo-user header outside production; in production these endpoints answer 401. The address form's checks (6-digit PIN code, 10-digit mobile number) are Zod schemas in @manasbal/types, for the shop to reuse.
