import { PageState } from "@manasbal/ui";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { HomeCatalog } from "@/components/home-catalog";
import { PAGE_FRAME } from "@/lib/page-frame";

// The welcome is part of the page's static shell; the categories and products come from the API
// on each request (connection()), so a build needs no API. If the API is down, a call throws and
// the page's error.tsx takes over.
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });
  const loading = await getTranslations({ locale, namespace: "Loading" });

  return (
    <div className={`${PAGE_FRAME} gap-12 py-12`}>
      <div className="flex max-w-2xl flex-col gap-3">
        <h1 className="font-semibold text-heading-2">{t("title")}</h1>
        <p className="text-body text-muted">{t("tagline")}</p>
      </div>
      <Suspense
        fallback={<PageState kind="loading" title={loading("products")} headingLevel={2} />}
      >
        <HomeCatalog locale={locale} />
      </Suspense>
    </div>
  );
}
