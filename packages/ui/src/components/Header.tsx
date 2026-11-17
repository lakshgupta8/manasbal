import type { ElementType, ReactNode } from "react";
import { LotusMark } from "./LotusMark";
import "./Header.css";

export interface HeaderLink {
  readonly href: string;
  readonly label: string;
}

/** What a custom link component (for example the shop's Link) is given. */
export interface HeaderLinkProps {
  readonly href: string;
  readonly className?: string;
  readonly children: ReactNode;
}

export interface HeaderProps {
  /** The main links, in order. With none, no navigation is drawn. */
  readonly links: readonly HeaderLink[];
  /** Where the logo leads. */
  readonly homeHref?: string;
  /** Slot for the currency switch. */
  readonly currency?: ReactNode;
  /** Slot for the language switch. */
  readonly languageSwitch?: ReactNode;
  /** Slot for the account link. */
  readonly account?: ReactNode;
  /** Slot for the cart link. */
  readonly cart?: ReactNode;
  /** The main navigation's name, in the page's language. */
  readonly navLabel?: string;
  /** The element or component that draws the logo and main links. Defaults to a plain <a>. */
  readonly linkAs?: ElementType<HeaderLinkProps>;
}

/** The top of every page: the logo, the main links and the currency, language, account and cart
 * slots. */
export function Header({
  links,
  homeHref = "/",
  currency,
  languageSwitch,
  account,
  cart,
  navLabel = "Main",
  linkAs: Link = "a",
}: HeaderProps) {
  return (
    <header className="mb-header">
      <Link className="mb-header__brand" href={homeHref}>
        <LotusMark size={32} />
        <span>Manasbal</span>
      </Link>
      {links.length > 0 && (
        <nav aria-label={navLabel} className="mb-header__nav">
          <ul>
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="mb-header__actions">
        {currency}
        {languageSwitch}
        {account}
        {cart}
      </div>
    </header>
  );
}
