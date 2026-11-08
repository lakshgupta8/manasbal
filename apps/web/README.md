# @manasbal/web

The Manasbal storefront: Next.js (App Router) with Tailwind CSS.
The shop reads the API at `API_URL`. Put `API_URL=http://localhost:3001` in `apps/web/.env.local` (see the root `.env.example`).

```bash
pnpm --filter @manasbal/web dev    # http://localhost:3000
```

## Reaching the API

Use the helper in `src/lib/api.ts` for every call: `apiCall((api) => api.GET("/categories"))`. On the server it calls `API_URL` directly; in the browser it calls the shop's own address, which forwards to the API, so the refresh cookie is first-party ([ADR 0012](../../docs/adr/0012-shop-reaches-the-api-through-its-own-address.md)). Every call times out after 5 seconds and fails with a typed error (`ApiUnavailableError` or `ApiResponseError`), which the page's `error.tsx` shows as "This page couldn't load".

The forwarded paths are `/auth/*` (kept as it is, where the refresh cookie lives) and `/api/*` (everything else). No page may use them. The rewrites read `API_URL` when the shop is built.

## Signing in

`/[locale]/sign-in` signs in with an email and password, or with one click as one of the demo logins (`DEMO_EMAILS` from `@manasbal/types`, with the public `DEMO_PASSWORD` from `@manasbal/seed`). `src/lib/auth.ts` makes the calls (`/auth/sign-in`, `/auth/refresh`, `/auth/sign-out`, `/me`) through the shop's own address.

The access token lives only in memory, in `AuthProvider` (`src/components/auth-provider.tsx`), never in storage. On load it renews the session from the refresh cookie, so a reload keeps you signed in, and it renews it again a minute before the token expires. Only one renewal runs at a time, because each refresh cookie works once. The header's account slot shows "Sign in", or who is signed in and **Sign out**.

## Languages

The shop speaks English (`/en/...`, the default: `/` goes to `/en`) and Hindi (`/hi/...`), with [next-intl](https://next-intl.dev). Every word on a page lives in `messages/en.json` and `messages/hi.json`; a test checks both have the same keys. The Hindi is a draft until a native speaker reads it: `hi.json` says so in `_status`, and Hindi pages say so in the footer. The header's switch links to the same page in the other language.

- `src/i18n/routing.ts` lists the languages; `src/i18n/request.ts` loads each page's messages, reading the language from the address with `next/root-params`.
- `src/proxy.ts` puts every page under a language. It never touches `/api/*` or `/auth/*`, which go to the API (see above), and `src/proxy.test.ts` checks that.
- Shared components from `@manasbal/ui` take their words as props, so the shop passes them in its language.
- Hindi text uses Noto Sans Devanagari (SIL OFL 1.1, through `next/font`), since Geist has no Devanagari letters; English pages never download it.
