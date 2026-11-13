import { AlertIcon, ClockIcon, InfoIcon, PackageIcon } from "@manasbal/icons";
import type { ReactNode } from "react";
import "./PageState.css";

/** loading: data is on its way; error: it could not load; empty: nothing to show; not-found. */
export type PageStateKind = "loading" | "error" | "empty" | "not-found";

export interface PageStateProps {
  readonly kind: PageStateKind;
  /** What is happening, in the page's language. */
  readonly title: string;
  /** More words under the title. */
  readonly children?: ReactNode;
  /** What the visitor can do next: a "Try again" button, a link home. */
  readonly action?: ReactNode;
  /** The title's heading level: 1 when the state is the whole page, 2 inside one. Defaults to 1. */
  readonly headingLevel?: 1 | 2;
  readonly className?: string;
}

const ICONS = {
  loading: ClockIcon,
  error: AlertIcon,
  empty: PackageIcon,
  "not-found": InfoIcon,
} as const;

/**
 * A page, or part of one, that has no content to show yet or at all: an icon and words that say
 * what is happening, and an optional next step. Never colour alone: the icon is decorative, the
 * words carry the meaning. A loading state is a polite live region, so screen readers hear it
 * once; the others are plain content under their heading.
 */
export function PageState({
  kind,
  title,
  children,
  action,
  headingLevel = 1,
  className,
}: PageStateProps) {
  const Icon = ICONS[kind];
  const Heading = `h${headingLevel}` as const;
  const live = kind === "loading" ? { role: "status", "aria-live": "polite" as const } : {};

  return (
    <div
      {...live}
      className={["mb-page-state", `mb-page-state--${kind}`, className].filter(Boolean).join(" ")}
    >
      <span className="mb-page-state__icon">
        <Icon />
      </span>
      <Heading className="mb-page-state__title">{title}</Heading>
      {children && <div className="mb-page-state__body">{children}</div>}
      {action && <div className="mb-page-state__action">{action}</div>}
    </div>
  );
}
