import type { Currency } from "@manasbal/ui";
import { cookies } from "next/headers";

// The cookie that keeps the visitor's choice of currency for prices. Prices are always whole
// paise; USD only changes how they are shown (see Price and DEMO_USD_RATE in @manasbal/ui).
export const CURRENCY_COOKIE = "currency";

// "USD" shows dollars; anything else (no cookie, an old or edited value) shows rupees.
export function toCurrency(value: string | undefined | null): Currency {
  return value === "USD" ? "USD" : "INR";
}

// The visitor's currency, from the cookie. Reading cookies makes a render depend on the request,
// so only the parts of a page that are already rendered per request (inside a Suspense boundary:
// the catalogue, the category page, the header's switch) call this; the cached shell never does.
export async function getCurrency(): Promise<Currency> {
  return toCurrency((await cookies()).get(CURRENCY_COOKIE)?.value);
}
