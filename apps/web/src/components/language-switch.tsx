"use client";

import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Suspense } from "react";
import { LANGUAGE_NAMES, localizedPath, otherLocale, type Locale } from "@/i18n/routing";

// A plain link to the same page in the other language, so it works without JavaScript. The
// language's own name carries its lang, and the link says which language it leads to. An address
// only known at request time (an unknown page) links to the other language's home page until the
// real one streams in.
export function LanguageSwitch() {
  return (
    <Suspense fallback={<LanguageLink />}>
      <ThisPageInTheOtherLanguage />
    </Suspense>
  );
}

function ThisPageInTheOtherLanguage() {
  return <LanguageLink pathname={usePathname()} />;
}

// Leads to `pathname` in the other language, or to its home page without one.
export function LanguageLink({ pathname }: { readonly pathname?: string }) {
  const t = useTranslations("Frame");
  const target = otherLocale(useLocale() as Locale);
  return (
    <a href={pathname ? localizedPath(pathname, target) : `/${target}`} hrefLang={target}>
      {t.rich("languageSwitch", {
        lang: () => <span lang={target}>{LANGUAGE_NAMES[target]}</span>,
      })}
    </a>
  );
}
