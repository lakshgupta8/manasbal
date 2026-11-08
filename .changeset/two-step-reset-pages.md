---
"@manasbal/web": minor
---

Signing in with two-step sign-in on now asks for the 6-digit code from the authenticator app, or a recovery code, in the same card. New pages: `/en/forgot-password`, which always answers "If this email has an account, a link is on its way", and `/en/reset-password?token=...`, which sets a new password with the sign-up rule and then says "Sign in with your new password".
