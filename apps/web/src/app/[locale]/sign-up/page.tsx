import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth-form-parts";
import { SignUpForm } from "@/components/auth-forms";
import { wordsFor } from "@/i18n/words";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-up">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SignUp" });
  return { title: t("pageTitle") };
}

// The sign-up card: the form (src/components/sign-up-form.tsx) draws its own title, because it
// changes to "Check your email" once the account exists.
export default async function SignUpPage({ params }: PageProps<"/[locale]/sign-up">) {
  const { locale } = await params;

  return (
    <AuthCard>
      <SignUpForm words={await wordsFor(locale, "SignUp")} signInHref={`/${locale}/sign-in`} />
    </AuthCard>
  );
}
