import { ProductCard, type ProductCardProps } from "./ProductCard";
import "./ProductGrid.css";

export interface ProductGridItem extends ProductCardProps {
  /** Unique within the grid. */
  readonly id: string;
}

export interface ProductGridProps {
  /** The products, in the order they are shown and tabbed through. */
  readonly products: readonly ProductGridItem[];
  /** What an empty grid says, in the page's language. Defaults to "No products here yet". */
  readonly emptyLabel?: string;
  /** Passed to every card (see ProductCard). */
  readonly linkAs?: ProductCardProps["linkAs"];
  /** Passed to every card (see ProductCard). */
  readonly headingLevel?: ProductCardProps["headingLevel"];
  readonly className?: string;
}

/**
 * Product cards in a list laid out as a grid: 1 column below 600 px, 2 from 600 px, 4 from
 * 1024 px, 24 px apart. The card order is the reading and tab order, row by row.
 */
export function ProductGrid({
  products,
  emptyLabel = "No products here yet",
  linkAs,
  headingLevel,
  className,
}: ProductGridProps) {
  const classes = ["mb-product-grid", className].filter(Boolean).join(" ");
  if (products.length === 0) {
    return <p className={`${classes} mb-product-grid--empty`}>{emptyLabel}</p>;
  }

  return (
    <ul className={classes}>
      {products.map(({ id, ...product }) => (
        <li key={id}>
          <ProductCard linkAs={linkAs} headingLevel={headingLevel} {...product} />
        </li>
      ))}
    </ul>
  );
}
