import { REFRESH_TOKEN_HOURS } from "./tokens.service.js";

export const REFRESH_COOKIE = "refresh_token";

// SameSite=None + Secure in production (the shop calls the API cross-site); Lax locally, where
// both run on localhost without HTTPS. ADR 0011. Path /auth: only the auth routes receive it.
export function refreshCookieOptions(production = process.env.NODE_ENV === "production") {
  return {
    httpOnly: true,
    path: "/auth",
    maxAge: REFRESH_TOKEN_HOURS * 3600,
    sameSite: production ? "none" : "lax",
    secure: production,
  } as const;
}
