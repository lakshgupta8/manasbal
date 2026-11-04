import { createTranslator, NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";

// The real message files, so tests read the words the pages show.
export const MESSAGES = { en, hi } as const;
export type TestLocale = keyof typeof MESSAGES;

// Wraps a client component (or a sync server one) in the provider the layout gives every page.
export function withIntl(ui: ReactNode, locale: TestLocale = "en") {
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      {ui}
    </NextIntlClientProvider>
  );
}

// Stands in for next-intl/server, whose real version only runs inside Next.js's server:
// vi.mock("next-intl/server", () => import("@/test/intl")).
export function getTranslations({ locale, namespace }: { locale: TestLocale; namespace: string }) {
  return Promise.resolve(
    createTranslator({ locale, messages: MESSAGES[locale], namespace: namespace as never }),
  );
}
