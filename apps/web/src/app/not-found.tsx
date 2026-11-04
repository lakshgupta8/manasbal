import Link from "next/link";

// Shown for an address with no page behind it.
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-md text-muted">
        There&apos;s nothing at this address. The link may be mistyped, or the page may have moved.
      </p>
      <Link href="/" className="underline underline-offset-4">
        Go to the home page
      </Link>
    </div>
  );
}
