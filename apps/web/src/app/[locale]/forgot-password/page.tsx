import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth-form-parts";
import { ForgotPasswordForm } from "@/components/auth-forms";
import { wordsFor } from "@/i18n/words";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/forgot-password">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ForgotPassword" });
  return { title: t("pageTitle") };
}

// Asks for a reset link (src/components/forgot-password-form.tsx).
export default async function ForgotPasswordPage({
  params,
}: PageProps<"/[locale]/forgot-password">) {
  const { locale } = await params;

  return (
    <AuthCard>
      <ForgotPasswordForm
        words={await wordsFor(locale, "ForgotPassword")}
        signInHref={`/${locale}/sign-in`}
      />
    </AuthCard>
  );
}
