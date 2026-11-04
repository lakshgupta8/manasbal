# 0012: The shop reaches the API through its own address

- **Status:** Proposed
- **Date:** 2026-12-01

## Context

The shop runs on Vercel and the API on Render, at two different addresses, so the browser treats them as two different sites. [ADR 0011](0011-first-party-authentication.md) keeps the refresh token in an `httpOnly` cookie that the API sets. When the shop calls the API directly from the browser, that cookie belongs to another site: it is a third-party cookie. Safari blocks third-party cookies by default, and other browsers are moving the same way. Without the cookie, a visitor is signed out on every reload.

## Decision

- **The browser only ever talks to the shop's address.** The shop forwards API paths to `API_URL` with Next.js rewrites (`apps/web/next.config.ts`, built from `apps/web/src/lib/api-routes.ts`):
  - `/auth/*` goes to the API's `/auth/*` on the same path, because the API sets the refresh cookie on `Path=/auth`.
  - `/api/*` goes to the API's `/*`, for every other endpoint.
  - No page may use the `/auth` or `/api` prefixes.
- **One helper calls the API** (`apps/web/src/lib/api.ts`):
  - On the server, it calls `API_URL` directly; one server talking to another needs no cookie, and this saves a hop.
  - In the browser, it calls the shop's own address through the paths above.
  - Every call has a timeout. Failures throw typed errors: `ApiUnavailableError` when the API can't be reached, and `ApiResponseError` (with the status and the problem's title) when it answers with an error.
  - The access token is passed in from memory, never stored in `localStorage`.
- **The API counts one more proxy.** With Vercel's proxy in front of Render's, `TRUSTED_PROXY_HOPS` on Render goes from `1` to `2` once the rewrite is live, so the rate limits keep counting each visitor by their own address.

## Why

Through the rewrite, the refresh cookie is set by the shop's own address and sent back to it, so it is a first-party cookie, which every browser accepts. The alternatives cost more. Putting the API on a subdomain of the shop's domain needs a custom domain for both, which the free plans and the zero-cost rule rule out. Keeping the token anywhere JavaScript can read it would undo ADR 0011. Forwarding `/auth/*` on its own path, rather than under `/api`, keeps the cookie's path working with no change to the API.

## Consequences

- This changes one part of ADR 0011: the shop no longer calls the API cross-site from the browser.
  - The refresh cookie could become `SameSite=Lax` in production; a later change can make that switch.
  - The CORS allow-list still guards direct calls, and the origin check on `/auth/refresh` and `/auth/sign-out` still applies, since the forwarded request keeps the browser's `Origin`.
- Every browser call takes one more hop, through Vercel, before it reaches Render.
- `API_URL` must be set when the shop is built, because the rewrites are fixed at build time. A build without it, such as a pull request's checks, has no rewrites.
- `TRUSTED_PROXY_HOPS` must be `2` on Render once the rewrite is live. Left at `1`, every visitor would be counted as Vercel's address.
- A page that needs data uses the helper. Its errors reach the page's `error.tsx`, which says the page couldn't load.
