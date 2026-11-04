import { defineRouting } from "next-intl/routing";

// The shop's languages. The first part of every page's address is one of these: /en/..., /hi/...
// None may be "api" or "auth", which lead to the API (src/lib/api-routes.ts).
export const routing = defineRouting({
  locales: ["en", "hi"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

// Each language's own name for itself, shown on the switch that leads to it.
export const LANGUAGE_NAMES: Readonly<Record<Locale, string>> = {
  en: "English",
  hi: "हिन्दी",
};

// The other language: the shop has two.
export function otherLocale(locale: Locale): Locale {
  return locale === "en" ? "hi" : "en";
}

// The same page in another language: the address's first segment is swapped.
export function localizedPath(pathname: string, locale: Locale): string {
  const [, , ...rest] = pathname.split("/");
  return rest.length === 0 || (rest.length === 1 && rest[0] === "")
    ? `/${locale}`
    : `/${locale}/${rest.join("/")}`;
}
