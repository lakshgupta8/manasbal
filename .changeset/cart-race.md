---
"@manasbal/api": patch
---

Two first adds to the cart at once no longer fail on a duplicate cart: making the cart skips the insert if another request made it first, and both use that cart.
