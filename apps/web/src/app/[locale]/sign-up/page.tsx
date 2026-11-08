import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth-form-parts";
import { SignUpForm } from "@/components/auth-forms";
import type { SignUpWords } from "@/components/sign-up-form";

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
  const t = await getTranslations({ locale, namespace: "SignUp" });
  const words: SignUpWords = {
    title: t("title"),
    name: t("name"),
    nameHint: t("nameHint"),
    email: t("email"),
    emailHint: t("emailHint"),
    password: t("password"),
    passwordHint: t("passwordHint"),
    required: t("required"),
    showPassword: t("showPassword"),
    adult: t("adult"),
    demoNote: t("demoNote"),
    submit: t("submit"),
    signInLink: t("signInLink"),
    nameMissing: t("nameMissing"),
    emailMissing: t("emailMissing"),
    emailInvalid: t("emailInvalid"),
    passwordTooShort: t("passwordTooShort"),
    adultMissing: t("adultMissing"),
    refused: t("refused"),
    unavailable: t("unavailable"),
    tooManyTriesOneMinute: t("tooManyTriesOneMinute"),
    // The number and the address are filled in the browser.
    tooManyTriesMinutes: t("tooManyTriesMinutes", { minutes: "{minutes}" }),
    tooManyTries: t("tooManyTries"),
    checkEmailTitle: t("checkEmailTitle"),
    checkEmailBody: t("checkEmailBody", { email: "{email}" }),
    backToSignIn: t("backToSignIn"),
  };

  return (
    <AuthCard>
      <SignUpForm words={words} signInHref={`/${locale}/sign-in`} />
    </AuthCard>
  );
}
