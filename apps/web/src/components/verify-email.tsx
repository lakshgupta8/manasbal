"use client";

import { Button } from "@manasbal/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { verifyEmail } from "@/lib/auth";
import { CardLink } from "./auth-form-parts";
import { LinkNotValid, type LinkNotValidWords } from "./link-not-valid";

export interface VerifyEmailWords extends LinkNotValidWords {
  readonly checkingTitle: string;
  readonly confirmedTitle: string;
  readonly confirmedBody: string;
  readonly signIn: string;
  readonly unavailableTitle: string;
  readonly unavailableBody: string;
  readonly tryAgain: string;
}

export interface VerifyEmailProps {
  readonly words: VerifyEmailWords;
  readonly signInHref: string;
  // Where a new link comes from: a password reset mail also confirms the email.
  readonly newLinkHref: string;
}

type Result = "checking" | "confirmed" | "invalid" | "unavailable";

// Each link works once. One check per token is shared by everyone who asks, so React running the
// effect twice can't spend the token twice and then call a good link "not valid".
const checks = new Map<string, Promise<boolean>>();

export function checkOnce(token: string): Promise<boolean> {
  let check = checks.get(token);
  if (check === undefined) {
    check = verifyEmail(token);
    checks.set(token, check);
    // A failed attempt may be tried again.
    check.catch(() => checks.delete(token));
  }
  return check;
}

// Confirms the email with the token in the address (?token=...), as soon as the page opens.
export function VerifyEmail({ words, signInHref, newLinkHref }: VerifyEmailProps) {
  const router = useRouter();
  const token = useSearchParams().get("token")?.trim() ?? "";
  const [result, setResult] = useState<Result>(token === "" ? "invalid" : "checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (token === "") return;
    let current = true;
    checkOnce(token).then(
      (confirmed) => {
        if (current) setResult(confirmed ? "confirmed" : "invalid");
      },
      () => {
        if (current) setResult("unavailable");
      },
    );
    return () => {
      current = false;
    };
  }, [token, attempt]);

  function tryAgain() {
    setResult("checking");
    setAttempt((count) => count + 1);
  }

  if (result === "invalid") {
    return (
      <div aria-live="polite" className="flex flex-col gap-6">
        <LinkNotValid words={words} newLinkHref={newLinkHref} signInHref={signInHref} />
      </div>
    );
  }

  const view = {
    checking: { title: words.checkingTitle, body: null, action: null },
    confirmed: {
      title: words.confirmedTitle,
      body: words.confirmedBody,
      action: (
        <Button className="w-full" onClick={() => router.push(signInHref)}>
          {words.signIn}
        </Button>
      ),
    },
    unavailable: {
      title: words.unavailableTitle,
      body: words.unavailableBody,
      action: (
        <Button className="w-full" onClick={tryAgain}>
          {words.tryAgain}
        </Button>
      ),
    },
  }[result];

  return (
    // The heading changes once the link is checked, and is read out when it does.
    <div aria-live="polite" className="flex flex-col gap-6">
      <h1 className="font-semibold text-heading-2">{view.title}</h1>
      {view.body !== null && <p>{view.body}</p>}
      {view.action}
      {result === "unavailable" && (
        <div>
          <CardLink href={signInHref}>{words.backToSignIn}</CardLink>
        </div>
      )}
    </div>
  );
}
