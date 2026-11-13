"use client";

import { Button, Checkbox, TextField } from "@manasbal/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { signUp, type SignUpOutcome } from "@/lib/auth";
import {
  CardLink,
  FormAlert,
  looksLikeEmail,
  MIN_PASSWORD_LENGTH,
  type TooManyTriesWords,
} from "./auth-form-parts";
import { ResendLink } from "./resend-link";
import { useFormAlert } from "./use-form-alert";

// Every word on the form, translated on the server so no translation code reaches the browser.
export interface SignUpWords extends TooManyTriesWords {
  readonly title: string;
  readonly name: string;
  readonly nameHint: string;
  readonly email: string;
  readonly emailHint: string;
  readonly password: string;
  readonly passwordHint: string;
  readonly required: string;
  readonly showPassword: string;
  readonly adult: string;
  readonly demoNote: string;
  readonly submit: string;
  readonly signInLink: string;
  readonly nameMissing: string;
  readonly emailMissing: string;
  readonly emailInvalid: string;
  readonly passwordTooShort: string;
  readonly adultMissing: string;
  readonly refused: string;
  readonly unavailable: string;
  readonly checkEmailTitle: string;
  // Holds an {email} placeholder, filled in the browser.
  readonly checkEmailBody: string;
  readonly resend: string;
  readonly resendSent: string;
  readonly backToSignIn: string;
}

export interface SignUpFormProps {
  readonly words: SignUpWords;
  readonly signInHref: string;
}

type Field = "name" | "email" | "password" | "confirmAdult";
type FieldErrors = Partial<Record<Field, string>>;

const FIELDS: readonly Field[] = ["name", "email", "password", "confirmAdult"];

interface Details {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly adult: boolean;
}

function check(words: SignUpWords, { name, email, password, adult }: Details): FieldErrors {
  const errors: FieldErrors = {};
  if (name === "") errors.name = words.nameMissing;
  if (email === "") errors.email = words.emailMissing;
  else if (!looksLikeEmail(email)) errors.email = words.emailInvalid;
  if (password.length < MIN_PASSWORD_LENGTH) errors.password = words.passwordTooShort;
  if (!adult) errors.confirmAdult = words.adultMissing;
  return errors;
}

// Creates an account with made-up details. The 18+ box starts unticked and must be ticked. With
// mail off the account can sign in at once, so the visitor goes to sign-in; with mail on, the
// card says "Check your email".
export function SignUpForm({ words, signInHref }: SignUpFormProps) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const { alert, waiting, show, tooManyTries } = useFormAlert(words);
  const [mailedTo, setMailedTo] = useState<string | null>(null);

  // The card's content changes, so the new heading takes the focus and is read out.
  useEffect(() => {
    if (mailedTo !== null) heading.current?.focus();
  }, [mailedTo]);

  // Shows at least one error, and moves to the first field that has one.
  function showFieldErrors(found: FieldErrors) {
    setErrors(found);
    const first = FIELDS.find((field) => found[field]) as Field;
    (form.current?.elements.namedItem(first) as HTMLInputElement).focus();
  }

  function explain(outcome: SignUpOutcome, email: string) {
    switch (outcome.kind) {
      case "created":
        if (outcome.emailConfirmed) router.push(signInHref);
        else setMailedTo(email);
        return;
      case "refused":
        show(words.refused);
        return;
      case "tooManyTries":
        tooManyTries(outcome.retryAfterSeconds);
        return;
    }
  }

  async function create(details: Details) {
    setBusy(true);
    setErrors({});
    show(null);
    try {
      const { name, email, password } = details;
      explain(await signUp({ name, email, password }), email);
    } catch {
      show(words.unavailable);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    // The text fields' values are strings; an unticked box sends nothing.
    const details: Details = {
      name: (data.get("name") as string).trim(),
      email: (data.get("email") as string).trim(),
      password: data.get("password") as string,
      adult: data.has("confirmAdult"),
    };
    const found = check(words, details);
    if (Object.keys(found).length > 0) return showFieldErrors(found);
    void create(details);
  }

  if (mailedTo !== null) {
    return (
      <>
        <h1 ref={heading} tabIndex={-1} className="font-semibold text-heading-2 focus:outline-none">
          {words.checkEmailTitle}
        </h1>
        <p>{words.checkEmailBody.replace("{email}", mailedTo)}</p>
        <ResendLink email={mailedTo} words={words} />
        <CardLink href={signInHref}>{words.backToSignIn}</CardLink>
      </>
    );
  }

  return (
    <>
      <h1 className="font-semibold text-heading-2">{words.title}</h1>
      {alert !== null && <FormAlert>{alert}</FormAlert>}
      <form
        ref={form}
        noValidate
        aria-busy={busy}
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
      >
        <TextField
          name="name"
          autoComplete="name"
          label={words.name}
          hint={words.nameHint}
          error={errors.name}
        />
        <TextField
          name="email"
          type="email"
          autoComplete="email"
          label={words.email}
          hint={words.emailHint}
          error={errors.email}
        />
        <TextField
          name="password"
          type="password"
          autoComplete="new-password"
          required
          requiredText={words.required}
          showPasswordLabel={words.showPassword}
          label={words.password}
          hint={words.passwordHint}
          error={errors.password}
        />
        <Checkbox name="confirmAdult" label={words.adult} error={errors.confirmAdult} />
        <p className="text-text-muted">{words.demoNote}</p>
        <Button type="submit" className="w-full" disabled={busy || waiting}>
          {words.submit}
        </Button>
      </form>
      <div>
        <CardLink href={signInHref}>{words.signInLink}</CardLink>
      </div>
    </>
  );
}
