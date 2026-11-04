import { DemoBanner, Footer, Header } from "@manasbal/ui";
import type { ReactNode } from "react";

export const MAIN_ID = "main-content";
export const REPO_URL = "https://github.com/lakshgupta8/manasbal";

const HEADER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/#categories", label: "Categories" },
];

// Credits joins these in Week 9.
const FOOTER_LINKS = [{ href: REPO_URL, label: "Source code on GitHub" }];

// The frame of every page: the skip link first (so Tab reaches it before anything else), the demo
// banner, the header, the page and the footer. The account, cart and language slots are filled
// once those pages exist.
export function SiteFrame({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <a
        href={`#${MAIN_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-lake focus:px-4 focus:py-2 focus:text-on-brand"
      >
        Skip to main content
      </a>
      <DemoBanner />
      <Header links={HEADER_LINKS} />
      <main id={MAIN_ID} tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
        {children}
      </main>
      <Footer
        links={FOOTER_LINKS}
        smallPrint="Manasbal is a portfolio demo: nothing here is for sale, and payments and delivery are simulated."
      />
    </>
  );
}
