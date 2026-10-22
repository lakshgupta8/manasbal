# @manasbal/api

## 0.2.0

### Minor Changes

- 42094d6: Rate limit the API to 100 requests a minute per visitor, counted in Valkey. Requests over the limit get a 429 problem+json response with a Retry-After header. /health is not limited. If Valkey is unreachable, requests are let through.
- The API describes itself at /docs (and as OpenAPI JSON at /docs-json), and every error comes back as application/problem+json.
- 0fd4dda: Requests that change something can carry an Idempotency-Key header. A repeat with the same key within 24 hours gets the first answer back (marked Idempotent-Replayed: true) instead of doing the work twice.

## 0.1.0

### Minor Changes

- 7602279: `/health` now reports the deployed version, so a deploy can confirm the new build is live.
