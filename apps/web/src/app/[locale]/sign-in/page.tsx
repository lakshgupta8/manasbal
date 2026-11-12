import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth-form-parts";
import { SignInForm } from "@/components/auth-forms";
import { wordsFor } from "@/i18n/words";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-in">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SignIn" });
  return { title: t("pageTitle") };
}

// One centred card with the form (src/components/sign-in-form.tsx). It draws its own title,
// because an account with two-step sign-in on then asks for its code in the same card.
export default async function SignInPage({ params }: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;

  return (
    <AuthCard>
      <SignInForm
        words={await wordsFor(locale, "SignIn")}
        twoStepWords={await wordsFor(locale, "TwoStep")}
        homeHref={`/${locale}`}
        forgotPasswordHref={`/${locale}/forgot-password`}
        createAccountHref={`/${locale}/sign-up`}
      />
    </AuthCard>
  );
}
