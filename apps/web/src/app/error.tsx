"use client"; // Error boundaries must be client components.

import Link from "next/link";

export interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly retry: () => void;
}

// Shown when a page fails to load, such as when the API is down. The message stays general: in
// production the error's own message is hidden from the browser anyway.
export default function ErrorPage({ retry }: ErrorPageProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">This page couldn&apos;t load</h1>
      <p className="max-w-md text-muted">
        Something went wrong on our side, or the shop lost touch with its data for a moment. Try
        again in a little while.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-md bg-lake px-4 py-2 font-medium text-on-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lake"
        >
          Try again
        </button>
        <Link href="/" className="underline underline-offset-4">
          Go to the home page
        </Link>
      </div>
    </div>
  );
}
