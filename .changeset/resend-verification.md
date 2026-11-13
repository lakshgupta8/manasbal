---
"@manasbal/api": minor
---

`POST /auth/resend-verification` asks for a new email confirmation link. It always answers 202 with no body, whatever the email, so it can't be used to find accounts; only an unconfirmed account gets a new link, and only when mail is on, and the older links stop working. It counts toward the /auth rate limit and is audited as `auth.verify_email.resend`.
