"use client"; // Error boundaries must be client components.

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

// Shown when a page fails to load, such as when the API is down. The message stays general: in
// production the error's own message is hidden from the browser anyway.
export default function ErrorPage({ retry }: ErrorPageProps) {
  const { locale } = useParams<{ locale: string }>();
  const lang = locale === "hi" ? "hi" : "en";
  const words = WORDS[lang];
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">{words.heading}</h1>
      <p className="max-w-md text-muted">{words.body}</p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-md bg-lake px-4 py-2 font-medium text-on-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lake"
        >
          {words.retry}
        </button>
        <Link href={`/${lang}`} className="underline underline-offset-4">
          {words.home}
        </Link>
      </div>
    </div>
  );
}
