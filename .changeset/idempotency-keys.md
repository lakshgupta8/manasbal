---
"@manasbal/api": minor
---

Requests that change something can carry an Idempotency-Key header. A repeat with the same key within 24 hours gets the first answer back (marked Idempotent-Replayed: true) instead of doing the work twice.
