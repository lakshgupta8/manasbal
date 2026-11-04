import { DemoBanner, Footer, Header } from "@manasbal/ui";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { LanguageSwitch } from "./language-switch";

export const MAIN_ID = "main-content";
export const REPO_URL = "https://github.com/lakshgupta8/manasbal";

export interface SiteFrameProps {
  readonly locale: string;
  readonly children: ReactNode;
}

// The frame of every page: the skip link first (so Tab reaches it before anything else), the demo
// banner, the header, the page and the footer, all in the page's language. The account and cart
// slots are filled once those pages exist.
export async function SiteFrame({ locale, children }: SiteFrameProps) {
  const t = await getTranslations({ locale, namespace: "Frame" });
  const home = `/${locale}`;
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
        languageSwitch={<LanguageSwitch />}
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
