import { PageState } from "@manasbal/ui";
import { useTranslations } from "next-intl";

// Shown while a product page waits for the product: a polite status, read out once.
export default function ProductLoading() {
  const t = useTranslations("Loading");
  return <PageState kind="loading" title={t("product")} />;
}
