import type { ProductSummary } from "@manasbal/sdk";
import { CategoryTiles, ProductGrid, type Currency } from "@manasbal/ui";
import Link from "next/link";
import type { Category } from "@/lib/catalog";

// Every product in this demo store is made-up data, and the API has no per-product flag yet, so
// every card says "Sample". When ProductSummary gains one, read it here instead.
const ALL_SAMPLE_DATA = true;

// The words a product card needs, from the page's Catalog messages.
export function productWords(
  catalog: (key: "sample" | "rupees" | "noProducts" | "about" | "dollars" | "cents") => string,
): ProductsProps["words"] {
  return {
    sample: catalog("sample"),
    rupees: catalog("rupees"),
    empty: catalog("noProducts"),
    about: catalog("about"),
    dollars: catalog("dollars"),
    cents: catalog("cents"),
  };
}

export interface ProductsProps {
  readonly locale: string;
  readonly products: readonly ProductSummary[];
  // In the page's language.
  readonly words: {
    readonly sample: string;
    readonly rupees: string;
    readonly empty: string;
    readonly about: string;
    readonly dollars: string;
    readonly cents: string;
  };
  // Rupees, or dollars for display (the visitor's choice, see lib/currency).
  readonly currency?: Currency;
  // 3 under the page's section headings.
  readonly headingLevel?: 2 | 3;
}

// The products as cards, each linking to its page, in the shop's language.
export function Products({
  locale,
  products,
  words,
  currency = "INR",
  headingLevel = 3,
}: ProductsProps) {
  return (
    <ProductGrid
      linkAs={Link}
      headingLevel={headingLevel}
      emptyLabel={words.empty}
      products={products.map((product) => ({
        id: product.id,
        name: product.name,
        href: `/${locale}/p/${product.slug}`,
        pricePaise: product.pricePaise,
        sample: ALL_SAMPLE_DATA,
        sampleLabel: words.sample,
        priceUnit: words.rupees,
        currency,
        dollarWords: { about: words.about, dollars: words.dollars, cents: words.cents },
      }))}
    />
  );
}

export interface CategoryLinksProps {
  readonly locale: string;
  readonly categories: readonly Category[];
}

// Categories as tiles, each linking to its page.
export function CategoryLinks({ locale, categories }: CategoryLinksProps) {
  return (
    <CategoryTiles
      linkAs={Link}
      categories={categories.map((category) => ({
        name: category.name,
        href: `/${locale}/c/${category.slug}`,
      }))}
    />
  );
}
