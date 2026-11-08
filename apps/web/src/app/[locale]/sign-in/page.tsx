import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth-form-parts";
import { SignInForm } from "@/components/auth-forms";
import type { SignInWords } from "@/components/sign-in-form";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-in">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SignIn" });
  return { title: t("pageTitle") };
}

// One centred card: the title, then the form (src/components/sign-in-form.tsx), whose words are
// translated here.
export default async function SignInPage({ params }: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SignIn" });
  const words: SignInWords = {
    demoHeading: t("demoHeading"),
    roles: {
      customer: t("roles.customer"),
      seller: t("roles.seller"),
      seller_staff: t("roles.seller_staff"),
      support: t("roles.support"),
      admin: t("roles.admin"),
    },
    email: t("email"),
    emailHint: t("emailHint"),
    password: t("password"),
    passwordHint: t("passwordHint"),
    required: t("required"),
    showPassword: t("showPassword"),
    submit: t("submit"),
    forgotPassword: t("forgotPassword"),
    createAccount: t("createAccount"),
    emailMissing: t("emailMissing"),
    emailInvalid: t("emailInvalid"),
    passwordMissing: t("passwordMissing"),
    wrongPassword: t("wrongPassword"),
    notConfirmed: t("notConfirmed"),
    tooManyTriesOneMinute: t("tooManyTriesOneMinute"),
    // The number is filled in the browser, once the API has said how long to wait.
    tooManyTriesMinutes: t("tooManyTriesMinutes", { minutes: "{minutes}" }),
    tooManyTries: t("tooManyTries"),
    twoStep: t("twoStep"),
    unavailable: t("unavailable"),
  };

  return (
    <AuthCard>
      <h1 className="font-semibold text-heading-2">{t("title")}</h1>
      <SignInForm
        words={words}
        homeHref={`/${locale}`}
        forgotPasswordHref={`/${locale}/forgot-password`}
        createAccountHref={`/${locale}/sign-up`}
      />
    </AuthCard>
  );
}
