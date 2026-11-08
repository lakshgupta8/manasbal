import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-form-parts";
import { VerifyEmail } from "@/components/auth-forms";
import type { VerifyEmailWords } from "@/components/verify-email";

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
  const t = await getTranslations({ locale, namespace: "VerifyEmail" });
  const words: VerifyEmailWords = {
    checkingTitle: t("checkingTitle"),
    confirmedTitle: t("confirmedTitle"),
    confirmedBody: t("confirmedBody"),
    signIn: t("signIn"),
    invalidTitle: t("invalidTitle"),
    invalidBody: t("invalidBody"),
    askForNewLink: t("askForNewLink"),
    backToSignIn: t("backToSignIn"),
    unavailableTitle: t("unavailableTitle"),
    unavailableBody: t("unavailableBody"),
    tryAgain: t("tryAgain"),
  };

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
