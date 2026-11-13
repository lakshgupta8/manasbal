import { PageState } from "@manasbal/ui";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

// Shown for a category slug that isn't in the tree, or a page cursor the API can't read.
export default function CategoryNotFound() {
  const t = useTranslations("Category");
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
