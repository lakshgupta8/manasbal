import { PageState } from "@manasbal/ui";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

// Shown for a product slug the API doesn't know.
export default function ProductNotFound() {
  const t = useTranslations("Product");
  const catalog = useTranslations("Catalog");
  const locale = useLocale();
  return (
    <PageState
      kind="not-found"
      title={t("notFoundHeading")}
      action={
        <Link href={`/${locale}`} className="text-body underline underline-offset-4">
          {catalog("home")}
        </Link>
      }
    >
      <p>{t("notFoundBody")}</p>
    </PageState>
  );
}
