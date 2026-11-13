import { CurrencySwitch } from "@manasbal/ui";
import { getTranslations } from "next-intl/server";
import { setCurrency } from "@/lib/currency-action";
import { getCurrency } from "@/lib/currency";

// The header's currency switch, showing the visitor's current choice from the cookie. The site
// frame renders it inside a Suspense boundary, because the cookie is only known per request.
export async function CurrencyControl({ locale }: { readonly locale: string }) {
  const [t, current] = await Promise.all([
    getTranslations({ locale, namespace: "Frame" }),
    getCurrency(),
  ]);
  return (
    <CurrencySwitch
      current={current}
      action={setCurrency}
      label={t("currencyLabel")}
      names={{ INR: t("currencyInr"), USD: t("currencyUsd") }}
    />
  );
}
