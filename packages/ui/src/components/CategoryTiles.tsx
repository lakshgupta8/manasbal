import { ChevronRightIcon } from "@manasbal/icons";
import type { ElementType, ReactNode } from "react";
import "./CategoryTiles.css";

export interface CategoryTile {
  readonly href: string;
  readonly name: string;
}

/** What a custom link component (for example the shop's locale-aware Link) is given. */
export interface CategoryTilesLinkProps {
  readonly href: string;
  readonly className: string;
  readonly children: ReactNode;
}

export interface CategoryTilesProps {
  /** The categories, in the order they are shown and tabbed through. */
  readonly categories: readonly CategoryTile[];
  /** The element or component that draws each link. Defaults to a plain <a>. */
  readonly linkAs?: ElementType<CategoryTilesLinkProps>;
  readonly className?: string;
}

/**
 * Categories as a list of tiles, each one a link with the category's name and a chevron. The
 * tiles fill the row: as many 220 px columns as fit, so 1 on a narrow phone, 4 or more on a
 * desktop.
 */
export function CategoryTiles({ categories, linkAs: Link = "a", className }: CategoryTilesProps) {
  return (
    <ul className={["mb-category-tiles", className].filter(Boolean).join(" ")}>
      {categories.map((category) => (
        <li key={category.href}>
          <Link href={category.href} className="mb-category-tiles__tile">
            <span>{category.name}</span>
            <ChevronRightIcon size={20} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
