import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-form-parts";
import { VerifyEmail } from "@/components/auth-forms";
import { wordsFor } from "@/i18n/words";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/verify-email">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "VerifyEmail" });
  return { title: t("pageTitle") };
}

// Where the link in the sign-up mail leads (/verify-email?token=...). The token is read and used
// in the browser, so the page itself is the same for everyone and is built ahead of time.
export default async function VerifyEmailPage({ params }: PageProps<"/[locale]/verify-email">) {
  const { locale } = await params;
  const words = await wordsFor(locale, "VerifyEmail");

  return (
    <AuthCard>
      <Suspense fallback={<h1 className="font-semibold text-heading-2">{words.checkingTitle}</h1>}>
        <VerifyEmail
          words={words}
          signInHref={`/${locale}/sign-in`}
          newLinkHref={`/${locale}/forgot-password`}
        />
      </Suspense>
    </AuthCard>
  );
}
