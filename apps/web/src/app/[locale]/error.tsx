"use client"; // Error boundaries must be client components.

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

export interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly retry: () => void;
}

// Shown when a page fails to load, such as when the API is down. The message stays general: in
// production the error's own message is hidden from the browser anyway.
export default function ErrorPage({ retry }: ErrorPageProps) {
  const t = useTranslations("Error");
  const locale = useLocale();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">{t("heading")}</h1>
      <p className="max-w-md text-muted">{t("body")}</p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-md bg-lake px-4 py-2 font-medium text-on-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lake"
        >
          {t("retry")}
        </button>
        <Link href={`/${locale}`} className="underline underline-offset-4">
          {t("home")}
        </Link>
      </div>
    </div>
  );
}
