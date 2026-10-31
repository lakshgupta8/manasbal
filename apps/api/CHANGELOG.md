# @manasbal/api

## 0.5.0

### Minor Changes

- 217df11: Reviews say whether they are samples.

### Patch Changes

- Updated dependencies [217df11]
  - @manasbal/types@0.3.0

## 0.4.0

### Minor Changes

- 523f076: Addresses no longer have a phone number: it is not stored, accepted or returned.

### Patch Changes

- 813c8af: Adds the shipments and settlements tables, so the demo data can hold deliveries and sellers' monthly payouts.
- 529247b: Describe every API endpoint and lint the API description with Spectral in CI.
- Updated dependencies [529247b]
- Updated dependencies [523f076]
- Updated dependencies [f0d897e]
  - @manasbal/types@0.2.0

## 0.3.0

### Minor Changes

- 3614471: Address changes are written to the audit log; GET /admin/audit-log lists it for admins.
- 59cc579: First versions of GET /cart, POST /cart/items and GET /orders.
- daca698: Lists categories as a tree.
- 8855a74: Shows stock per variant for a product.
- be0692a: Lists products page by page.
- b7df3f4: GET /sellers/:slug and GET /products/:slug/reviews
- 9d13564: GET /products/:slug answers one product with its category, seller and variants with stock.
- b7df3f4: Add GET /products/:slug/reviews, a product's reviews newest first, one page at a time.
- b7df3f4: Add GET /sellers/:slug, a store's public page with its product count. Only approved stores are shown.
- 8855a74: Add GET /products/:id/stock, which answers how many of each variant can be bought.
- e33cb81: A user can list, add, edit and delete their own delivery addresses at /me/addresses. Another user's address answers 404. Until sign-in exists, the user is named in an x-demo-user header outside production; in production these endpoints answer 401. The address form's checks (6-digit PIN code, 10-digit mobile number) are Zod schemas in @manasbal/types, for the shop to reuse.

### Patch Changes

- 1dd6e72: Mark demo rows with is_sample / created_by_visitor on every table visitors can write to
- f85c13d: The x-demo-user header is optional in the API description, so the client's demoUser option can set it
- 0f1834b: The API image runs on Node.js 24.22.1, the October 2026 security release.
- 0f1834b: Upgrade Zod to 4.6.7, which fixes CVE-2023-54404 (denial of service when validating a very large array).
- Updated dependencies [e33cb81]
- Updated dependencies [0f1834b]
  - @manasbal/types@0.1.0

## 0.2.0

### Minor Changes

- 42094d6: Rate limit the API to 100 requests a minute per visitor, counted in Valkey. Requests over the limit get a 429 problem+json response with a Retry-After header. /health is not limited. If Valkey is unreachable, requests are let through.
- The API describes itself at /docs (and as OpenAPI JSON at /docs-json), and every error comes back as application/problem+json.
- 0fd4dda: Requests that change something can carry an Idempotency-Key header. A repeat with the same key within 24 hours gets the first answer back (marked Idempotent-Replayed: true) instead of doing the work twice.

## 0.1.0

### Minor Changes

- 7602279: `/health` now reports the deployed version, so a deploy can confirm the new build is live.
