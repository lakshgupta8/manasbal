import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { Price, type Currency, type DollarWords } from "./Price";
import { Rating } from "./Rating";
import { SampleBadge } from "./SampleBadge";
import "./ProductCard.css";

export interface ProductCardImage {
  readonly src: string;
  /** What the picture shows, in the page's language. Pass "" only when it adds nothing. */
  readonly alt: string;
}

/** What a custom link component (for example the shop's locale-aware Link) is given. */
export interface ProductCardLinkProps {
  readonly href: string;
  readonly className: string;
  readonly children: ReactNode;
}

export interface ProductCardProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** The product's name: the card's heading and its one link. */
  readonly name: string;
  /** Where the name leads. */
  readonly href: string;
  /** The price in whole paise (see Price). With none (a product with no variants yet), no price
   * is shown. */
  readonly pricePaise?: number | null;
  /** The rating in halves; with none, no stars are drawn. */
  readonly rating?: number;
  /** The review count in words, e.g. "(120 reviews)"; shown only with a rating. */
  readonly reviews?: string;
  /** The words Rating reads out for the stars, in the page's language. */
  readonly ratingLabel?: string;
  /** The picture; with none, a grey box stands in and is hidden from assistive tech. */
  readonly image?: ProductCardImage;
  /** True when the product is sample data: shows the "Sample" badge on the picture. */
  readonly sample?: boolean;
  /** The badge's words in the page's language. Defaults to "Sample". */
  readonly sampleLabel?: string;
  /** The word screen readers say after the price (see Price). */
  readonly priceUnit?: string;
  /** INR (the default) or USD, for display only (see Price). */
  readonly currency?: Currency;
  /** The words screen readers say for a dollar price (see Price). */
  readonly dollarWords?: DollarWords;
  /** The heading level of the name, to fit the page's outline. Defaults to 3. */
  readonly headingLevel?: 2 | 3 | 4;
  /** The element or component that draws the link. Defaults to a plain <a>. */
  readonly linkAs?: ElementType<ProductCardLinkProps>;
  readonly className?: string;
}

/**
 * One product in a grid: its picture, name, rating and price. The name is the only link and the
 * only tab stop; the whole card is clickable through it. Nothing on it pushes people: no stock
 * counts, countdowns or discounts.
 *
 * It draws on surface.page in both themes, as in Figma: the stars' brand.primary on dark
 * surface.card would be about 2.4:1, below the 3:1 icon rule (see Rating).
 */
export function ProductCard({
  name,
  href,
  pricePaise,
  rating,
  reviews,
  ratingLabel,
  image,
  sample = false,
  sampleLabel,
  priceUnit,
  currency,
  dollarWords,
  headingLevel = 3,
  linkAs: Link = "a",
  className,
  ...props
}: ProductCardProps) {
  const Heading = `h${headingLevel}` as const;

  return (
    <article {...props} className={["mb-product-card", className].filter(Boolean).join(" ")}>
      <Heading className="mb-product-card__name">
        <Link href={href} className="mb-product-card__link">
          {name}
        </Link>
      </Heading>
      <div className="mb-product-card__picture">
        {image ? (
          <img src={image.src} alt={image.alt} loading="lazy" decoding="async" />
        ) : (
          <div className="mb-product-card__placeholder" aria-hidden="true" />
        )}
        {sample && (
          <SampleBadge kind="item" label={sampleLabel} className="mb-product-card__badge" />
        )}
      </div>
      {rating !== undefined && <Rating value={rating} label={ratingLabel} reviews={reviews} />}
      {typeof pricePaise === "number" && (
        <Price paise={pricePaise} unit={priceUnit} currency={currency} dollarWords={dollarWords} />
      )}
    </article>
  );
}
