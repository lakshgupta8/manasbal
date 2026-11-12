import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { routing } from "./routing";

// The language and messages for one request. The language is the one a caller names, or else the
// address's [locale] segment, read with next/root-params so no request headers are touched and
// every page can be rendered at build time. An unknown language falls back to the default; the
// layout answers 404 for it before anything is shown.
export default getRequestConfig(async ({ locale: named }) => {
  const requested = named ?? (await rootLocale());
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
