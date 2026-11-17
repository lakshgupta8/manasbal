// Where sign-in sends the visitor afterwards: the ?next= a page asked for (the account pages send
// a signed-out visitor to sign in with their own address), or the home page. Only this shop's own
// pages in the same language count, so a link can't use sign-in to send someone to another site:
// anything else, or anything odd, goes home.

// The base that relative paths are read against. It is never visited, only compared.
const SHOP = "https://shop.invalid";

export function returnPath(next: unknown, locale: string): string {
  const home = `/${locale}`;
  if (typeof next !== "string") return home;
  // Backslashes and control characters can make a browser read a path as another host.
  if (/[\\\p{Cc}]/u.test(next)) return home;
  if (next !== home && !next.startsWith(`${home}/`)) return home;
  // Starting with /en/ it can only be a path on this shop. Read it as a browser would follow it,
  // and check it is still in this language once dot segments (/en/../x) are worked out.
  const url = new URL(next, SHOP);
  if (url.pathname !== home && !url.pathname.startsWith(`${home}/`)) return home;
  return `${url.pathname}${url.search}`;
}

// The sign-in address that comes back to `path` afterwards.
export function signInFor(locale: string, path: string): string {
  return `/${locale}/sign-in?${new URLSearchParams({ next: path }).toString()}`;
}
