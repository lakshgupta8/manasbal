"use client"; // Error boundaries must be client components.

import { Button, PageState } from "@manasbal/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import WORDS from "../../../messages/error-page.json";

// An error page is a client component, so it reads its words straight from a message file rather
// than shipping a translation library to the browser. They have a file of their own, in both
// languages: importing en.json and hi.json here would send every page's words to the browser.

export interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly retry: () => void;
}

// Shown when a page fails to load, such as when the API is down: an alert icon, words that say
// so, "Try again" and a link home. The message stays general: in production the error's own
// message is hidden from the browser anyway.
export default function ErrorPage({ retry }: ErrorPageProps) {
  const { locale } = useParams<{ locale: string }>();
  const lang = locale === "hi" ? "hi" : "en";
  const words = WORDS[lang];
  return (
    <PageState
      kind="error"
      title={words.heading}
      action={
        <>
          <Button onClick={() => retry()}>{words.retry}</Button>
          <Link href={`/${lang}`} className="text-body underline underline-offset-4">
            {words.home}
          </Link>
        </>
      }
    >
      <p>{words.body}</p>
    </PageState>
  );
}
