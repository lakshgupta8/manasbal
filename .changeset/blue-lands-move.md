---
"@manasbal/api": patch
---

---

"@manasbal/api": minor
---

Rate limit the API to 100 requests a minute per visitor, counted in Valkey. Requests over the limit get a 429 problem+json response with a Retry-After header. /health is not limited. If Valkey is unreachable, requests are let through.
