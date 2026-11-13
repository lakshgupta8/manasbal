import { Breadcrumbs, PageState, Pagination } from "@manasbal/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CategoryLinks, Products } from "@/components/catalog-parts";
import {
  CATEGORY_PAGE_SIZE,
  findCategory,
  getProducts,
  isBadCursor,
  nextPage,
  pageNumber,
  previousPage,
  readTrail,
} from "@/lib/catalog";
import { getCategoryTree } from "@/lib/categories";
import { PAGE_FRAME } from "@/lib/page-frame";

type Props = PageProps<"/[locale]/c/[slug]">;

// The category, from the tree: the API has no lookup by slug, and its product list answers an
// unknown slug with an empty page, so a slug that isn't in the tree is not found.
async function categoryOf(slug: string) {
  const found = findCategory(await getCategoryTree(), slug);
  if (found === undefined) notFound();
  return found;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await categoryOf(slug);
  return { title: category.name };
}

// One category: where it sits, its name, its subcategories as tiles, then its products, 12 to a
// page, with previous and next page links. Rendered on each request; the address carries the
// page (see readTrail). A stopped API throws, and error.tsx shows the error state.
export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const [{ category, ancestors }, search, t, catalog] = await Promise.all([
    categoryOf(slug),
    searchParams,
    getTranslations({ locale, namespace: "Category" }),
    getTranslations({ locale, namespace: "Catalog" }),
  ]);
  const trail = readTrail(search);

  let page;
  try {
    page = await getProducts({
      category: slug,
      cursor: trail.cursor,
      limit: CATEGORY_PAGE_SIZE,
    });
  } catch (error) {
    // A cursor someone edited in the address: there is no such page.
    if (isBadCursor(error)) notFound();
    throw error;
  }

  const home = `/${locale}`;
  const base = `${home}/c/${slug}`;
  const hasSubcategories = category.children.length > 0;
  const hasProducts = page.items.length > 0;
  const previous = previousPage(base, trail);
  const next = nextPage(base, trail, page.nextCursor);

  return (
    <div className={`${PAGE_FRAME} gap-8 py-8`}>
      <Breadcrumbs
        label={t("breadcrumbs")}
        linkAs={Link}
        trail={[
          { href: home, label: t("home") },
          ...ancestors.map((above) => ({ href: `${home}/c/${above.slug}`, label: above.name })),
        ]}
        current={category.name}
      />
      <h1 className="font-semibold text-heading-2">{category.name}</h1>
      {hasSubcategories && (
        <section aria-labelledby="subcategories-heading" className="flex flex-col gap-6">
          <h2 id="subcategories-heading" className="font-semibold text-heading-3">
            {t("subcategories", { name: category.name })}
          </h2>
          <CategoryLinks locale={locale} categories={category.children} />
        </section>
      )}
      {hasProducts && (
        <Products
          locale={locale}
          products={page.items}
          headingLevel={2}
          words={{
            sample: catalog("sample"),
            rupees: catalog("rupees"),
            empty: catalog("noProducts"),
          }}
        />
      )}
      {!hasProducts && !hasSubcategories && (
        <PageState
          kind="empty"
          title={catalog("noProducts")}
          headingLevel={2}
          action={
            <Link href={home} className="text-body underline underline-offset-4">
              {catalog("home")}
            </Link>
          }
        >
          <p>{t("emptyBody")}</p>
        </PageState>
      )}
      {(previous !== undefined || next !== undefined) && (
        <Pagination
          label={t("pages")}
          linkAs={Link}
          previousHref={previous}
          nextHref={next}
          previousLabel={t("previous")}
          nextLabel={t("next")}
          status={t("page", { number: pageNumber(trail) })}
        />
      )}
    </div>
  );
}
