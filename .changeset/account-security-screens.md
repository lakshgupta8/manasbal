---
"@manasbal/web": minor
---

The account has two new pages: where you're signed in (`/en/account/sessions`), with "End session" for
each browser, and two-step sign-in (`/en/account/two-step`), which switches it on with a QR code (made
in the browser) or a typed key and a code from the app, shows the recovery codes once, and switches
it off with a code. Demo logins see that two-step is off for them.
