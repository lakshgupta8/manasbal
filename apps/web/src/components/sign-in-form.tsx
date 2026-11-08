"use client";

import { DEMO_PASSWORD } from "@manasbal/seed/demo-logins";
import type { Role } from "@manasbal/types";
import { DEMO_EMAILS } from "@manasbal/types/demo-logins";
import { Button, TextField } from "@manasbal/ui";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { signIn, type SignInOutcome } from "@/lib/auth";
import {
  CardLink,
  DEFAULT_WAIT_SECONDS,
  FormAlert,
  looksLikeEmail,
  tooManyTriesText,
  type TooManyTriesWords,
} from "./auth-form-parts";
import { useAuth } from "./auth-provider";

// Every word on the form, translated on the server so no translation code reaches the browser.
export interface SignInWords extends TooManyTriesWords {
  readonly demoHeading: string;
  readonly roles: Readonly<Record<Role, string>>;
  readonly email: string;
  readonly emailHint: string;
  readonly password: string;
  readonly passwordHint: string;
  readonly required: string;
  readonly showPassword: string;
  readonly submit: string;
  readonly forgotPassword: string;
  readonly createAccount: string;
  readonly emailMissing: string;
  readonly emailInvalid: string;
  readonly passwordMissing: string;
  readonly wrongPassword: string;
  readonly notConfirmed: string;
  readonly twoStep: string;
  readonly unavailable: string;
}

export interface SignInFormProps {
  readonly words: SignInWords;
  // Where a signed-in visitor goes next.
  readonly homeHref: string;
  readonly forgotPasswordHref: string;
  readonly createAccountHref: string;
}

type Field = "email" | "password";
type FieldErrors = Partial<Record<Field, string>>;

// The demo logins, in the order of the roles.
const DEMO_ROLES = Object.keys(DEMO_EMAILS) as Role[];
// The empty fields and a malformed email, before anything is sent.
function check(words: SignInWords, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (email === "") errors.email = words.emailMissing;
  else if (!looksLikeEmail(email)) errors.email = words.emailInvalid;
  if (password === "") errors.password = words.passwordMissing;
  return errors;
}

// Sign in with an email and password, or with one click as one of the demo logins (the default
// path: their password is public). Each problem is said in words next to the field it is about;
// too many tries is an alert under the title, with the wait the API gave, and the button waits too.
export function SignInForm({
  words,
  homeHref,
  forgotPasswordHref,
  createAccountHref,
}: SignInFormProps) {
  const router = useRouter();
  const { signedIn } = useAuth();
  const form = useRef<HTMLFormElement>(null);
  const demoHeadingId = useId();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [waitUntil, setWaitUntil] = useState<number | null>(null);

  useEffect(() => {
    if (waitUntil === null) return;
    const timer = setTimeout(() => {
      setWaitUntil(null);
      setAlert(null);
    }, waitUntil - Date.now());
    return () => clearTimeout(timer);
  }, [waitUntil]);

  // Shows at least one error, and moves to the first field that has one.
  function showFieldErrors(found: FieldErrors) {
    setErrors(found);
    const first: Field = found.email ? "email" : "password";
    (form.current?.elements.namedItem(first) as HTMLInputElement).focus();
  }

  async function explain(outcome: SignInOutcome) {
    switch (outcome.kind) {
      case "signedIn":
        await signedIn(outcome.session);
        router.push(homeHref);
        return;
      case "wrongPassword":
        return showFieldErrors({ password: words.wrongPassword });
      case "notConfirmed":
        return showFieldErrors({ email: words.notConfirmed });
      case "invalid":
        return showFieldErrors({ email: words.emailInvalid });
      case "tooManyTries": {
        const seconds = outcome.retryAfterSeconds;
        setAlert(tooManyTriesText(words, seconds));
        setWaitUntil(Date.now() + (seconds ?? DEFAULT_WAIT_SECONDS) * 1000);
        return;
      }
      case "twoStep":
        setAlert(words.twoStep);
        return;
    }
  }

  async function attempt(email: string, password: string) {
    setBusy(true);
    setErrors({});
    setAlert(null);
    try {
      await explain(await signIn(email, password));
    } catch {
      setAlert(words.unavailable);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    // Both fields are text inputs, so their values are strings.
    const email = (data.get("email") as string).trim();
    const password = data.get("password") as string;
    const found = check(words, email, password);
    if (Object.keys(found).length > 0) return showFieldErrors(found);
    void attempt(email, password);
  }

  return (
    <>
      {alert !== null && <FormAlert>{alert}</FormAlert>}
      <section aria-labelledby={demoHeadingId} className="flex flex-col gap-4">
        <h2 id={demoHeadingId} className="font-medium text-body">
          {words.demoHeading}
        </h2>
        <div className="flex flex-wrap gap-2">
          {DEMO_ROLES.map((role) => (
            <Button
              key={role}
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void attempt(DEMO_EMAILS[role], DEMO_PASSWORD)}
            >
              {words.roles[role]}
            </Button>
          ))}
        </div>
      </section>
      <form
        ref={form}
        noValidate
        aria-busy={busy}
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
      >
        <TextField
          name="email"
          type="email"
          autoComplete="username"
          label={words.email}
          hint={words.emailHint}
          error={errors.email}
        />
        <TextField
          name="password"
          type="password"
          autoComplete="current-password"
          required
          requiredText={words.required}
          showPasswordLabel={words.showPassword}
          label={words.password}
          hint={words.passwordHint}
          error={errors.password}
        />
        <Button type="submit" className="mt-2 w-full" disabled={busy || waitUntil !== null}>
          {words.submit}
        </Button>
      </form>
      <div className="flex flex-col items-start gap-2">
        <CardLink href={forgotPasswordHref}>{words.forgotPassword}</CardLink>
        <CardLink href={createAccountHref}>{words.createAccount}</CardLink>
      </div>
    </>
  );
}
