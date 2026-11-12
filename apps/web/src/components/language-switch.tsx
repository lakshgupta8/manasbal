"use client";

import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { localizedPath, type Locale } from "@/i18n/routing";

export interface LanguageSwitchProps {
  // The language the link leads to.
  readonly target: Locale;
  // The label, already translated on the server, so no translation code reaches the browser.
  readonly children: ReactNode;
}

// A plain link to the same page in the other language, so it works without JavaScript. Only the
// address is worked out here. An address only known at request time (an unknown page) links to
// the other language's home page until the real one streams in.
export function LanguageSwitch({ target, children }: LanguageSwitchProps) {
  return (
    <Suspense fallback={<LanguageLink target={target}>{children}</LanguageLink>}>
      <ThisPageInTheOtherLanguage target={target}>{children}</ThisPageInTheOtherLanguage>
    </Suspense>
  );
}

function ThisPageInTheOtherLanguage({ target, children }: LanguageSwitchProps) {
  return (
    <LanguageLink target={target} pathname={usePathname()}>
      {children}
    </LanguageLink>
  );
}

// Leads to `pathname` in the target language, or to its home page without one.
export function LanguageLink({
  target,
  pathname,
  children,
}: LanguageSwitchProps & { readonly pathname?: string }) {
  return (
    <a href={pathname ? localizedPath(pathname, target) : `/${target}`} hrefLang={target}>
      {children}
    </a>
  );
}
