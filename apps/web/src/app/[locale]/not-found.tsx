import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

// Shown for an address with no page behind it, in the address's language.
export default function NotFound() {
  const t = useTranslations("NotFound");
  const locale = useLocale();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">{t("heading")}</h1>
      <p className="max-w-md text-muted">{t("body")}</p>
      <Link href={`/${locale}`} className="underline underline-offset-4">
        {t("home")}
      </Link>
    </div>
  );
}
