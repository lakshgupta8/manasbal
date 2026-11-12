import type { ReactNode } from "react";
import { LotusMark } from "./LotusMark";
import "./Header.css";

export interface HeaderLink {
  readonly href: string;
  readonly label: string;
}

export interface HeaderProps {
  /** The main links, in order. With none, no navigation is drawn. */
  readonly links: readonly HeaderLink[];
  /** Where the logo leads. */
  readonly homeHref?: string;
  /** Slot for the language switch. */
  readonly languageSwitch?: ReactNode;
  /** Slot for the account link. */
  readonly account?: ReactNode;
  /** Slot for the cart link. */
  readonly cart?: ReactNode;
  /** The main navigation's name, in the page's language. */
  readonly navLabel?: string;
}

/** The top of every page: the logo, the main links and the language, account and cart slots. */
export function Header({
  links,
  homeHref = "/",
  languageSwitch,
  account,
  cart,
  navLabel = "Main",
}: HeaderProps) {
  return (
    <header className="mb-header">
      <a className="mb-header__brand" href={homeHref}>
        <LotusMark size={32} />
        <span>Manasbal</span>
      </a>
      {links.length > 0 && (
        <nav aria-label={navLabel} className="mb-header__nav">
          <ul>
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="mb-header__actions">
        {languageSwitch}
        {account}
        {cart}
      </div>
    </header>
  );
}
