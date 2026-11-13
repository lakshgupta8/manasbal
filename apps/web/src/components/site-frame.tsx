import { DemoBanner, Footer, Header } from "@manasbal/ui";
import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { LANGUAGE_NAMES, otherLocale, type Locale } from "@/i18n/routing";
import { AccountMenu } from "./account-menu";
import { CurrencyControl } from "./currency-control";
import { LanguageSwitch } from "./language-switch";

export const MAIN_ID = "main-content";
export const REPO_URL = "https://github.com/lakshgupta8/manasbal";

export interface SiteFrameProps {
  readonly locale: Locale;
  readonly children: ReactNode;
}

// The frame of every page: the skip link first (so Tab reaches it before anything else), the demo
// banner, the header, the page and the footer, all in the page's language. The cart slot is
// filled once the cart page exists.
export async function SiteFrame({ locale, children }: SiteFrameProps) {
  const t = await getTranslations({ locale, namespace: "Frame" });
  const home = `/${locale}`;
  const target = otherLocale(locale);
  // Only a draft translation has a note, and the footer shows it.
  const draftNote = t("draftNote");

  return (
    <>
      <a
        href={`#${MAIN_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-lake focus:px-4 focus:py-2 focus:text-on-brand"
      >
        {t("skipLink")}
      </a>
      <DemoBanner label={t("demoLabel")} heading={t("demoHeading")} detail={t("demoDetail")} />
      <Header
        homeHref={home}
        navLabel={t("mainNav")}
        links={[
          { href: home, label: t("home") },
          { href: `${home}#categories`, label: t("categories") },
        ]}
        currency={
          // The current choice is in a cookie, only known per request: the switch streams in.
          <Suspense fallback={null}>
            <CurrencyControl locale={locale} />
          </Suspense>
        }
        languageSwitch={
          // The other language's own name carries its lang.
          <LanguageSwitch target={target}>
            {t.rich("languageSwitch", {
              lang: () => <span lang={target}>{LANGUAGE_NAMES[target]}</span>,
            })}
          </LanguageSwitch>
        }
        account={
          <AccountMenu
            signInHref={`${home}/sign-in`}
            signInLabel={t("signIn")}
            signOutLabel={t("signOut")}
            signedInAs={t("signedInAs", { name: "{name}" })}
          />
        }
      />
      <main id={MAIN_ID} tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
        {children}
      </main>
      <Footer
        navLabel={t("footerNav")}
        // Credits joins this in Week 9.
        links={[{ href: REPO_URL, label: t("sourceCode") }]}
        smallPrint={draftNote === "" ? t("smallPrint") : `${t("smallPrint")} ${draftNote}`}
      />
    </>
  );
}
