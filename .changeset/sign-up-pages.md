---
"@manasbal/web": minor
"@manasbal/api": minor
"@manasbal/types": patch
---

The shop has a sign-up page (`/en/sign-up`) with an unticked 18+ box and a "use made-up details" note, and a confirm-email page (`/en/verify-email?token=...`). With mail off sign-up goes straight to sign-in; with mail on it says "Check your email". `POST /auth/sign-up` now answers `emailConfirmed`, so the shop knows which. The shop's error page reads its words from its own small file, and the browser's auth calls use `fetch` directly, which keeps the shop's client JS under its 200 kB budget.
