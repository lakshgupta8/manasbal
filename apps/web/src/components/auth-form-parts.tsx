import { AlertIcon } from "@manasbal/icons";
import type { ReactNode } from "react";

// Pieces the sign-in, sign-up and confirm-email pages share, so the browser gets one copy.

// The words for "too many tries": a wait of one minute, of {minutes} minutes, or one the API
// didn't give.
export interface TooManyTriesWords {
  readonly tooManyTriesOneMinute: string;
  readonly tooManyTriesMinutes: string;
  readonly tooManyTries: string;
}

// The sign-up rule for passwords, which a new password follows too (the API checks it as well).
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

// With no Retry-After, a button waits this long before it can be pressed again.
export const DEFAULT_WAIT_SECONDS = 60;

export function tooManyTriesText(words: TooManyTriesWords, seconds: number | undefined): string {
  if (seconds === undefined) return words.tooManyTries;
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes === 1
    ? words.tooManyTriesOneMinute
    : words.tooManyTriesMinutes.replace("{minutes}", String(minutes));
}

// Something@something.something, with no spaces: the API checks the rest. No regular expression,
// so a long input can't make it slow.
export function looksLikeEmail(email: string): boolean {
  const at = email.indexOf("@");
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  return at > 0 && !domain.includes("@") && dot > 0 && dot < domain.length - 1 && !/\s/.test(email);
}

// A problem with the whole form, under the title: an icon and words, never colour alone.
export function FormAlert({ children }: { readonly children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex gap-2 bg-feedback-error-border/8 px-3 py-2 border border-feedback-error-border rounded-lg text-feedback-error text-small"
    >
      <AlertIcon size={16} className="flex-none mt-0.5" />
      <p>{children}</p>
    </div>
  );
}

// The one centred card every sign-in page is drawn in: 384px wide at most, filling a phone.
export function AuthCard({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex flex-1 justify-center px-4 sm:px-6 py-6 sm:py-16">
      <div className="flex flex-col self-start gap-6 bg-surface-page p-6 sm:p-8 border border-border-default rounded-2xl w-full max-w-96 text-text-default">
        {children}
      </div>
    </div>
  );
}

// A link in the card, under the button.
export function CardLink({
  href,
  children,
}: {
  readonly href: string;
  readonly children: ReactNode;
}) {
  return (
    <a href={href} className="text-text-action underline">
      {children}
    </a>
  );
}
