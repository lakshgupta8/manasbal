"use server";

import { cookies } from "next/headers";
import { CURRENCY_COOKIE, toCurrency } from "./currency";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

// The currency switch's form action. Setting a cookie in a server action makes Next.js render the
// current page again, so its prices change in place. Only INR or USD is ever stored.
export async function setCurrency(form: FormData): Promise<void> {
  const chosen = form.get("currency");
  (await cookies()).set(CURRENCY_COOKIE, toCurrency(typeof chosen === "string" ? chosen : null), {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}
