---
"@manasbal/api": minor
"@manasbal/types": minor
---

Sign-in locks an email for 15 minutes after 5 wrong passwords (and the second step after 5 wrong codes); the refresh cookie routes only accept the shop's origins (WEB_ORIGINS); every auth event is audited without emails or passwords, so an audit entry's target can now be null.
