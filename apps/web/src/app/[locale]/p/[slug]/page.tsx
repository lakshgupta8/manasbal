import { Breadcrumbs, Button, Price } from "@manasbal/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect, RedirectType } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProductChoice } from "@/components/product-choice";
import { findCategory } from "@/lib/catalog";
import { getCategoryTree } from "@/lib/categories";
import { getCurrency } from "@/lib/currency";
import { PAGE_FRAME } from "@/lib/page-frame";
import { getProduct } from "@/lib/product";
import { variantAddress, variantFromForm, variantFromSku } from "@/lib/variants";

type Props = PageProps<"/[locale]/p/[slug]">;

async function productOf(slug: string) {
  const product = await getProduct(slug);
  if (product === undefined) notFound();
  return product;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await productOf(slug);
  return { title: product.name, description: product.description ?? undefined };
}

// One product: where it sits, its picture, name, seller, the chosen variant's price, the size
// and colour pickers, and whether it is in stock, in words. Rendered on each request; the address
// carries the chosen variant (?variant=<sku>). An unknown slug is not found; a stopped API throws,
// and error.tsx shows the error state.
export default async function ProductPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const [product, search, t, catalog, currency, tree] = await Promise.all([
    productOf(slug),
    searchParams,
    getTranslations({ locale, namespace: "Product" }),
    getTranslations({ locale, namespace: "Catalog" }),
    getCurrency(),
    getCategoryTree(),
  ]);

  const home = `/${locale}`;
  const path = `${home}/p/${slug}`;
  // The pickers' form without JavaScript sends ?size=&colour=; the address names a variant.
  const fromForm = variantFromForm(product.variants, search);
  if (fromForm !== undefined) redirect(variantAddress(path, fromForm), RedirectType.replace);
  const chosen = variantFromSku(product.variants, search);

  const { category } = product;
  const ancestors = findCategory(tree, category.slug)?.ancestors ?? [];

  return (
    <div className={`${PAGE_FRAME} gap-8 py-8`}>
      <Breadcrumbs
        label={t("breadcrumbs")}
        linkAs={Link}
        trail={[
          { href: home, label: t("home") },
          ...ancestors.map((above) => ({ href: `${home}/c/${above.slug}`, label: above.name })),
          { href: `${home}/c/${category.slug}`, label: category.name },
        ]}
        current={product.name}
      />
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* The API has no pictures yet: a plain block named after the product stands in. */}
        <div
          role="img"
          aria-label={product.name}
          className="aspect-square w-full rounded-lg bg-[var(--mb-color-surface-hover)]"
        />
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-semibold text-heading-2">{product.name}</h1>
            <p className="text-body text-muted">
              {t("soldBy", { store: product.seller.storeName })}
            </p>
            {/* The rating and review count go here, from the reviews call (Week 9). */}
          </div>
          {chosen === undefined ? (
            <p className="text-body font-medium">{t("outOfStock")}</p>
          ) : (
            <ProductChoice
              key={chosen.sku}
              variants={product.variants}
              chosen={chosen}
              path={path}
              prices={Object.fromEntries(
                product.variants.map((variant) => [
                  variant.sku,
                  <Price
                    key={variant.sku}
                    paise={variant.pricePaise}
                    size="large"
                    currency={currency}
                    unit={catalog("rupees")}
                    dollarWords={{
                      about: catalog("about"),
                      dollars: catalog("dollars"),
                      cents: catalog("cents"),
                    }}
                  />,
                ]),
              )}
              submit={
                <Button type="submit" variant="secondary" className="self-start">
                  {t("show")}
                </Button>
              }
              words={{
                choose: t("choose"),
                size: t("size"),
                colour: t("colour"),
                notAvailable: t("notAvailable"),
                inStock: t("inStock"),
                outOfStock: t("outOfStock"),
              }}
            />
          )}
          {product.description !== null && (
            <section aria-labelledby="description-heading" className="flex flex-col gap-2">
              <h2 id="description-heading" className="font-semibold text-heading-3">
                {t("description")}
              </h2>
              <p className="text-body">{product.description}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
