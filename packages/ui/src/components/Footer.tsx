import type { ReactNode } from "react";
import type { HeaderLink } from "./Header";
import "./Footer.css";

export type FooterLink = HeaderLink;

export interface FooterProps {
  /** The footer links, in order. With none, no navigation is drawn. */
  readonly links: readonly FooterLink[];
  /** One line of small print under the links. */
  readonly smallPrint: ReactNode;
  /** The footer navigation's name, in the page's language. */
  readonly navLabel?: string;
}

/** The bottom of every page: a list of links and a line of small print. */
export function Footer({ links, smallPrint, navLabel = "Footer" }: FooterProps) {
  return (
    <footer className="mb-footer">
      {links.length > 0 && (
        <nav aria-label={navLabel}>
          <ul>
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <p className="mb-footer__small-print">{smallPrint}</p>
    </footer>
  );
}
