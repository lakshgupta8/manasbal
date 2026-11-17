import { Breadcrumbs, PageState } from "@manasbal/ui";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { SessionList } from "@/components/auth-forms";
import { wordsFor } from "@/i18n/words";
import { PAGE_FRAME } from "@/lib/page-frame";
import { signInFor } from "@/lib/return-path";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account/sessions">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });
  return { title: t("sessionsPageTitle"), robots: { index: false } };
}

// Where the signed-in visitor is signed in, with "End session" for each. Drawn in the browser
// with the session it holds (src/components/account-security.tsx); a signed-out visitor is sent to
// sign in and comes back here. Rendered on each request, never stored.
export default async function SessionsPage({ params }: PageProps<"/[locale]/account/sessions">) {
  await connection();
  const { locale } = await params;
  const words = await wordsFor(locale, "Account");
  const home = `/${locale}`;
  const here = `${home}/account/sessions`;

  return (
    <div className={`${PAGE_FRAME} gap-6 py-8`}>
      <Breadcrumbs
        label={words.breadcrumbs}
        trail={[
          { href: home, label: words.home },
          { href: `${home}/account`, label: words.title },
        ]}
        current={words.sessionsTitle}
      />
      <SessionList
        words={words}
        locale={locale}
        signInHref={signInFor(locale, here)}
        states={{
          loading: <PageState kind="loading" title={words.sessionsLoading} />,
          listLoading: <PageState kind="loading" title={words.sessionsLoading} headingLevel={2} />,
          loadFailed: (
            <PageState
              kind="error"
              title={words.sessionsLoadFailed}
              headingLevel={2}
              action={
                // Loads the page again, which asks for the list again.
                <a href={here} className="text-body text-text-action underline">
                  {words.tryAgain}
                </a>
              }
            />
          ),
        }}
      />
    </div>
  );
}
