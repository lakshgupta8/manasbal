import { Breadcrumbs, Notice, PageState } from "@manasbal/ui";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { TwoStepSettings } from "@/components/auth-forms";
import { wordsFor } from "@/i18n/words";
import { PAGE_FRAME } from "@/lib/page-frame";
import { signInFor } from "@/lib/return-path";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account/two-step">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });
  return { title: t("twoStepPageTitle"), robots: { index: false } };
}

// Switching two-step sign-in on and off. Drawn in the browser with the session it holds
// (src/components/account-security.tsx); a signed-out visitor is sent to sign in and comes back
// here. Rendered on each request, never stored: the secret and recovery codes exist only in the
// page while they are shown.
export default async function TwoStepPage({ params }: PageProps<"/[locale]/account/two-step">) {
  await connection();
  const { locale } = await params;
  const words = await wordsFor(locale, "Account");
  const home = `/${locale}`;

  return (
    <div className={`${PAGE_FRAME} gap-6 py-8`}>
      <Breadcrumbs
        label={words.breadcrumbs}
        trail={[
          { href: home, label: words.home },
          { href: `${home}/account`, label: words.title },
        ]}
        current={words.twoStepTitle}
      />
      <TwoStepSettings
        words={words}
        signInHref={signInFor(locale, `${home}/account/two-step`)}
        states={{
          loading: <PageState kind="loading" title={words.twoStepLoading} />,
          demo: <Notice tone="info">{words.twoStepDemo}</Notice>,
        }}
      />
    </div>
  );
}
