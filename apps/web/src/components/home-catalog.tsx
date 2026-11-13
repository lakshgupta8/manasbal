import { Notice } from "@manasbal/ui";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { getProducts, HOME_PAGE_SIZE } from "@/lib/catalog";
import { getCategoryTree } from "@/lib/categories";
import { CategoryLinks, Products } from "./catalog-parts";

// The home page's categories and first products. Rendered on each request (connection()), never
// at build time, so a build needs no API. If the API is down, a call throws and the page's
// error.tsx takes over.
export async function HomeCatalog({ locale }: { readonly locale: string }) {
  await connection();
  const [t, catalog, categories, page] = await Promise.all([
    getTranslations({ locale, namespace: "Home" }),
    getTranslations({ locale, namespace: "Catalog" }),
    getCategoryTree(),
    getProducts({ limit: HOME_PAGE_SIZE }),
  ]);

  return (
    <>
      <section id="categories" aria-labelledby="categories-heading" className="flex flex-col gap-6">
        <h2 id="categories-heading" className="font-semibold text-heading-3">
          {t("categoriesHeading")}
        </h2>
        {categories.length === 0 ? (
          <Notice tone="info" leadWord={t("noteLead")}>
            {t("noCategories")}
          </Notice>
        ) : (
          <CategoryLinks locale={locale} categories={categories} />
        )}
      </section>
      <section aria-labelledby="products-heading" className="flex flex-col gap-6">
        <h2 id="products-heading" className="font-semibold text-heading-3">
          {t("productsHeading")}
        </h2>
        <Products
          locale={locale}
          products={page.items}
          words={{
            sample: catalog("sample"),
            rupees: catalog("rupees"),
            empty: catalog("noProducts"),
          }}
        />
      </section>
    </>
  );
}
