import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-form-parts";
import { ResetPasswordForm } from "@/components/auth-forms";
import { wordsFor } from "@/i18n/words";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/reset-password">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ResetPassword" });
  return { title: t("pageTitle") };
}

// Where the link in the reset mail leads (/reset-password?token=...). The token is read in the
// browser, so the page itself is built ahead of time.
export default async function ResetPasswordPage({ params }: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  const words = await wordsFor(locale, "ResetPassword");

  return (
    <AuthCard>
      <Suspense fallback={<h1 className="font-semibold text-heading-2">{words.title}</h1>}>
        <ResetPasswordForm
          words={words}
          signInHref={`/${locale}/sign-in`}
          newLinkHref={`/${locale}/forgot-password`}
        />
      </Suspense>
    </AuthCard>
  );
}
