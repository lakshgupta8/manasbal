import { Breadcrumbs, Notice, PageState } from "@manasbal/ui";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { AddressBook } from "@/components/auth-forms";
import { wordsFor } from "@/i18n/words";
import { PAGE_FRAME } from "@/lib/page-frame";
import { signInFor } from "@/lib/return-path";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account/addresses">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });
  return { title: t("addressesPageTitle"), robots: { index: false } };
}

// The signed-in visitor's delivery addresses: list, add, change and delete. Drawn in the browser
// with the session it holds (src/components/account-pages.tsx); a signed-out visitor is sent to
// sign in and comes back here. Rendered on each request, never stored.
export default async function AddressesPage({ params }: PageProps<"/[locale]/account/addresses">) {
  await connection();
  const { locale } = await params;
  const words = await wordsFor(locale, "Account");
  const home = `/${locale}`;
  const here = `${home}/account/addresses`;

  return (
    <div className={`${PAGE_FRAME} gap-6 py-8`}>
      <Breadcrumbs
        label={words.breadcrumbs}
        trail={[
          { href: home, label: words.home },
          { href: `${home}/account`, label: words.title },
        ]}
        current={words.addressesTitle}
      />
      <AddressBook
        words={words}
        signInHref={signInFor(locale, here)}
        states={{
          loading: <PageState kind="loading" title={words.addressesLoading} />,
          listLoading: <PageState kind="loading" title={words.addressesLoading} headingLevel={2} />,
          loadFailed: (
            <PageState
              kind="error"
              title={words.loadFailed}
              headingLevel={2}
              action={
                // Loads the page again, which asks for the list again.
                <a href={here} className="text-body text-text-action underline">
                  {words.tryAgain}
                </a>
              }
            />
          ),
          notice: <Notice tone="info">{words.madeUp}</Notice>,
        }}
      />
    </div>
  );
}
