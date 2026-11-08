# @manasbal/web

The Manasbal storefront: Next.js (App Router) with Tailwind CSS.
The shop reads the API at `API_URL`. Put `API_URL=http://localhost:3001` in `apps/web/.env.local` (see the root `.env.example`).

```bash
pnpm --filter @manasbal/web dev    # http://localhost:3000
```

## Reaching the API

Use the helper in `src/lib/api.ts` for every call: `apiCall((api) => api.GET("/categories"))`. On the server it calls `API_URL` directly; in the browser it calls the shop's own address, which forwards to the API, so the refresh cookie is first-party ([ADR 0012](../../docs/adr/0012-shop-reaches-the-api-through-its-own-address.md)). Every call times out after 5 seconds and fails with a typed error (`ApiUnavailableError` or `ApiResponseError`), which the page's `error.tsx` shows as "This page couldn't load". `error.tsx` is a client component, so its words live in their own small file, `messages/error-page.json` (both languages), rather than in `en.json` and `hi.json`, which would send every page's words to the browser.

The forwarded paths are `/auth/*` (kept as it is, where the refresh cookie lives) and `/api/*` (everything else). No page may use them. The rewrites read `API_URL` when the shop is built.

## Signing in

`/[locale]/sign-in` signs in with an email and password, or with one click as one of the demo logins (`DEMO_EMAILS` from `@manasbal/types`, with the public `DEMO_PASSWORD` from `@manasbal/seed`). `/[locale]/sign-up` creates an account with made-up details and an unticked 18+ box: with mail off the account can sign in at once, so the visitor goes to sign-in; with mail on, the page says "Check your email" (the API's `emailConfirmed` says which). The link in that mail leads to `/[locale]/verify-email?token=...`, which uses the token once and says "Your email is confirmed" or "This link is not valid any more".

An account with two-step sign-in on gets "Enter your code" in the same card after its password: the 6-digit code from the authenticator app, or a recovery code, sent with the challenge sign-in answered. `/[locale]/forgot-password` always says "If this email has an account, a link is on its way", whatever the email, and the link in that mail leads to `/[locale]/reset-password?token=...` for a new password (the sign-up rule). Whether a reset token still works is only known by using it, so a used or expired one says "This link is not valid any more" once the new password is sent; a missing one says it at once.

The forms take their words as written in the message files (`src/i18n/words.ts`), so a placeholder such as `{minutes}` reaches the browser to be filled there.

`src/lib/auth.ts` makes these calls (`/auth/*` and `/me`) through the shop's own address with `fetch` itself rather than the typed client, which keeps that client out of the browser's bundle; the bodies are still typed from `@manasbal/types`. The forms are exported together from `src/components/auth-forms.tsx`, so the pages share one chunk instead of each carrying its own copy of the fields.

The access token lives only in memory, in `AuthProvider` (`src/components/auth-provider.tsx`), never in storage. On load it renews the session from the refresh cookie, so a reload keeps you signed in, and it renews it again a minute before the token expires. Only one renewal runs at a time, because each refresh cookie works once. The header's account slot shows "Sign in", or who is signed in and **Sign out**.

## Languages

The shop speaks English (`/en/...`, the default: `/` goes to `/en`) and Hindi (`/hi/...`), with [next-intl](https://next-intl.dev). Every word on a page lives in `messages/en.json` and `messages/hi.json`; a test checks both have the same keys. A native speaker has read the Hindi, and `hi.json` says so in `_status`. New Hindi words are listed in their pull request until they are read too. A language still in draft gets a note after the footer's small print (`Frame.draftNote`, empty in both files today). The header's switch links to the same page in the other language.

- `src/i18n/routing.ts` lists the languages; `src/i18n/request.ts` loads each page's messages, reading the language from the address with `next/root-params`.
- `src/proxy.ts` puts every page under a language. It never touches `/api/*` or `/auth/*`, which go to the API (see above), and `src/proxy.test.ts` checks that.
- Shared components from `@manasbal/ui` take their words as props, so the shop passes them in its language.
- Hindi text uses Noto Sans Devanagari (SIL OFL 1.1, through `next/font`), since Geist has no Devanagari letters; English pages never download it.
