import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Categories } from "@/components/categories";

// The layout wraps every page in <main> (SiteFrame), so a page starts with its own content.
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });

  return (
    <div className="flex flex-col flex-1 justify-center items-center gap-6 px-6 py-24 text-center">
      <Image src="/manasbal-mark.svg" alt="" width={96} height={96} priority />
      <h1 className="font-semibold text-ink dark:text-white text-4xl tracking-tight">
        {t("title")}
      </h1>
      <p className="max-w-md text-ink/75 dark:text-white/75 text-lg">{t("tagline")}</p>
      <section id="categories" aria-labelledby="categories-heading">
        <h2 id="categories-heading">{t("categoriesHeading")}</h2>
        <Suspense fallback={<p>{t("loadingCategories")}</p>}>
          <Categories emptyText={t("noCategories")} noteLead={t("noteLead")} />
        </Suspense>
      </section>
    </div>
  );
}
