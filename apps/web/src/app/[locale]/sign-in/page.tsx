import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth-form-parts";
import { SignInForm } from "@/components/auth-forms";
import { wordsFor } from "@/i18n/words";
import { returnPath } from "@/lib/return-path";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-in">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SignIn" });
  return { title: t("pageTitle") };
}

// One centred card with the form (src/components/sign-in-form.tsx). It draws its own title,
// because an account with two-step sign-in on then asks for its code in the same card. After
// signing in, the visitor goes back to the page that sent them (?next=, checked by returnPath:
// only this shop's pages in this language), or home.
export default async function SignInPage({ params, searchParams }: PageProps<"/[locale]/sign-in">) {
  const [{ locale }, { next }] = await Promise.all([params, searchParams]);

  return (
    <AuthCard>
      <SignInForm
        words={await wordsFor(locale, "SignIn")}
        twoStepWords={await wordsFor(locale, "TwoStep")}
        homeHref={returnPath(next, locale)}
        forgotPasswordHref={`/${locale}/forgot-password`}
        createAccountHref={`/${locale}/sign-up`}
      />
    </AuthCard>
  );
}
