import { PageState } from "@manasbal/ui";
import { useTranslations } from "next-intl";

// Shown while a category page waits for its products: a polite status, read out once.
export default function CategoryLoading() {
  const t = useTranslations("Loading");
  return <PageState kind="loading" title={t("products")} />;
}
