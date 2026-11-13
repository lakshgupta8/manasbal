import type { ElementType, ReactNode } from "react";
import "./Breadcrumbs.css";

export interface BreadcrumbLink {
  readonly href: string;
  readonly label: string;
}

/** What a custom link component (for example the shop's locale-aware Link) is given. */
export interface BreadcrumbsLinkProps {
  readonly href: string;
  readonly className: string;
  readonly children: ReactNode;
}

export interface BreadcrumbsProps {
  /** The pages above this one, from the top (Home first). */
  readonly trail: readonly BreadcrumbLink[];
  /** This page's name: the last crumb, not a link. */
  readonly current: string;
  /** The navigation's name, in the page's language. Defaults to "Breadcrumbs". */
  readonly label?: string;
  /** The element or component that draws each link. Defaults to a plain <a>. */
  readonly linkAs?: ElementType<BreadcrumbsLinkProps>;
  readonly className?: string;
}

/**
 * Where this page sits: a named navigation with an ordered list of links up to this page, which
 * is marked aria-current="page" (W3C APG Breadcrumb pattern). The separators are drawn by CSS, so
 * screen readers don't read them.
 */
export function Breadcrumbs({
  trail,
  current,
  label = "Breadcrumbs",
  linkAs: Link = "a",
  className,
}: BreadcrumbsProps) {
  return (
    <nav aria-label={label} className={["mb-breadcrumbs", className].filter(Boolean).join(" ")}>
      <ol>
        {trail.map((crumb) => (
          <li key={crumb.href}>
            <Link href={crumb.href} className="mb-breadcrumbs__link">
              {crumb.label}
            </Link>
          </li>
        ))}
        <li>
          <span aria-current="page" className="mb-breadcrumbs__current">
            {current}
          </span>
        </li>
      </ol>
    </nav>
  );
}
