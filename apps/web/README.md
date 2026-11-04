# @manasbal/web

The Manasbal storefront: Next.js (App Router) with Tailwind CSS.
The shop reads the API at `API_URL`. Put `API_URL=http://localhost:3001` in `apps/web/.env.local` (see the root `.env.example`).

```bash
pnpm --filter @manasbal/web dev    # http://localhost:3000
```

## Reaching the API

Use the helper in `src/lib/api.ts` for every call: `apiCall((api) => api.GET("/categories"))`. On the server it calls `API_URL` directly; in the browser it calls the shop's own address, which forwards to the API, so the refresh cookie is first-party ([ADR 0012](../../docs/adr/0012-shop-reaches-the-api-through-its-own-address.md)). Every call times out after 5 seconds and fails with a typed error (`ApiUnavailableError` or `ApiResponseError`), which the page's `error.tsx` shows as "This page couldn't load".

The forwarded paths are `/auth/*` (kept as it is, where the refresh cookie lives) and `/api/*` (everything else). No page may use them. The rewrites read `API_URL` when the shop is built.
