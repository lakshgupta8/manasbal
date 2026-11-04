import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Sends / to /en and keeps every page under a language. It never runs for /api and /auth (which
// next.config.ts forwards to the API), Next.js's own files, or files with an extension.
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!(?:api|auth)(?:/|$)|_next/|_vercel/|.*\\..*).*)"],
};
