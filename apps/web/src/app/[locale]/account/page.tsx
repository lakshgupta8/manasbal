import { PageState } from "@manasbal/ui";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { AccountProfile } from "@/components/auth-forms";
import { wordsFor } from "@/i18n/words";
import { PAGE_FRAME } from "@/lib/page-frame";
import { signInFor } from "@/lib/return-path";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });
  return { title: t("pageTitle"), robots: { index: false } };
}

// The signed-in visitor's account: who they are, and links to their other pages. Drawn in the
// browser from the session it holds (src/components/account-pages.tsx); a signed-out visitor is
// sent to sign in and comes back here. Rendered on each request, never stored.
export default async function AccountPage({ params }: PageProps<"/[locale]/account">) {
  await connection();
  const { locale } = await params;
  const words = await wordsFor(locale, "Account");
  const home = `/${locale}`;

  return (
    <div className={`${PAGE_FRAME} gap-6 py-8`}>
      <AccountProfile
        words={words}
        loading={<PageState kind="loading" title={words.loading} />}
        signInHref={signInFor(locale, `${home}/account`)}
        links={{
          addresses: `${home}/account/addresses`,
          sessions: `${home}/account/sessions`,
          twoStep: `${home}/account/two-step`,
        }}
      />
    </div>
  );
}
