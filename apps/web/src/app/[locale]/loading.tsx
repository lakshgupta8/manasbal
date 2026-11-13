import { PageState } from "@manasbal/ui";
import { useTranslations } from "next-intl";

// Shown while a page waits for its data: a polite status, read out once.
export default function Loading() {
  const t = useTranslations("Loading");
  return <PageState kind="loading" title={t("message")} />;
}
