import { ChevronLeftIcon, ChevronRightIcon } from "@manasbal/icons";
import type { ElementType, ReactNode } from "react";
import "./Button.css";
import "./Pagination.css";

/** What a custom link component (for example the shop's locale-aware Link) is given. */
export interface PaginationLinkProps {
  readonly href: string;
  readonly className: string;
  readonly rel?: string;
  readonly children: ReactNode;
}

export interface PaginationProps {
  /** The previous page's address; on the first page there is none, and the link is shown off. */
  readonly previousHref?: string;
  /** The next page's address; on the last page there is none, and the link is shown off. */
  readonly nextHref?: string;
  /** "Previous page", in the page's language. */
  readonly previousLabel?: string;
  /** "Next page", in the page's language. */
  readonly nextLabel?: string;
  /** Where the visitor is, in the page's language, e.g. "Page 2". */
  readonly status: string;
  /** The navigation's name, in the page's language. Defaults to "Pages". */
  readonly label?: string;
  /** The element or component that draws each link. Defaults to a plain <a>. */
  readonly linkAs?: ElementType<PaginationLinkProps>;
  readonly className?: string;
}

/**
 * Previous and next page links with where the visitor is between them, drawn as secondary
 * buttons. A link with nowhere to go is shown off (aria-disabled, no href), so the layout never
 * jumps and keyboard users never land on a dead link.
 */
export function Pagination({
  previousHref,
  nextHref,
  previousLabel = "Previous page",
  nextLabel = "Next page",
  status,
  label = "Pages",
  linkAs: Link = "a",
  className,
}: PaginationProps) {
  const button = "mb-button mb-button--secondary mb-button--md mb-pagination__link";
  const step = (href: string | undefined, rel: string, words: string, icon: ReactNode) => {
    const content = (
      <>
        {rel === "prev" && icon}
        {words}
        {rel === "next" && icon}
      </>
    );
    return href === undefined ? (
      <span className={`${button} mb-pagination__link--off`} aria-disabled="true">
        {content}
      </span>
    ) : (
      <Link href={href} rel={rel} className={button}>
        {content}
      </Link>
    );
  };

  return (
    <nav aria-label={label} className={["mb-pagination", className].filter(Boolean).join(" ")}>
      {step(previousHref, "prev", previousLabel, <ChevronLeftIcon size={20} />)}
      <span className="mb-pagination__status">{status}</span>
      {step(nextHref, "next", nextLabel, <ChevronRightIcon size={20} />)}
    </nav>
  );
}
