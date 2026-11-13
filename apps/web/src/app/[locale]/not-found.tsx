import { PageState } from "@manasbal/ui";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

// Shown for an address with no page behind it, in the address's language.
export default function NotFound() {
  const t = useTranslations("NotFound");
  const locale = useLocale();
  return (
    <PageState
      kind="not-found"
      title={t("heading")}
      action={
        <Link href={`/${locale}`} className="text-body underline underline-offset-4">
          {t("home")}
        </Link>
      }
    >
      <p>{t("body")}</p>
    </PageState>
  );
}
