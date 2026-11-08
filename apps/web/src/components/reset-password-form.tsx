import { Button, TextField } from "@manasbal/ui";
import { useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { resetPassword } from "@/lib/auth";
import {
  CardLink,
  FormAlert,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  type TooManyTriesWords,
} from "./auth-form-parts";
import { LinkNotValid, type LinkNotValidWords } from "./link-not-valid";
import { useFormAlert } from "./use-form-alert";

export interface ResetPasswordWords extends TooManyTriesWords, LinkNotValidWords {
  readonly title: string;
  readonly password: string;
  readonly passwordHint: string;
  readonly required: string;
  readonly showPassword: string;
  readonly submit: string;
  readonly passwordTooShort: string;
  readonly passwordTooLong: string;
  readonly changedTitle: string;
  readonly changedBody: string;
  readonly signIn: string;
  readonly unavailable: string;
}

export interface ResetPasswordFormProps {
  readonly words: ResetPasswordWords;
  readonly signInHref: string;
  readonly newLinkHref: string;
}

type Result = "form" | "changed" | "linkInvalid";

// Where the link in the reset mail leads (?token=...): a new password, then "Sign in with your new
// password". A missing, used, expired or unknown token says "This link is not valid any more".
export function ResetPasswordForm({ words, signInHref, newLinkHref }: ResetPasswordFormProps) {
  const token = useSearchParams().get("token")?.trim() ?? "";
  const form = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<Result>(token === "" ? "linkInvalid" : "form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const { alert, waiting, show, tooManyTries } = useFormAlert(words);

  async function save(password: string) {
    setBusy(true);
    show(null);
    try {
      const outcome = await resetPassword(token, password);
      if (outcome.kind === "tooManyTries") tooManyTries(outcome.retryAfterSeconds);
      else setResult(outcome.kind);
    } catch {
      show(words.unavailable);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get("password") as string;
    let problem: string | undefined;
    if (password.length < MIN_PASSWORD_LENGTH) problem = words.passwordTooShort;
    else if (password.length > MAX_PASSWORD_LENGTH) problem = words.passwordTooLong;
    setError(problem);
    if (problem === undefined) void save(password);
    else (form.current?.elements.namedItem("password") as HTMLInputElement).focus();
  }

  if (result === "linkInvalid") {
    return <LinkNotValid words={words} newLinkHref={newLinkHref} signInHref={signInHref} />;
  }

  if (result === "changed") {
    return (
      <>
        <h1 className="font-semibold text-heading-2">{words.changedTitle}</h1>
        <output className="block">{words.changedBody}</output>
        <div>
          <CardLink href={signInHref}>{words.signIn}</CardLink>
        </div>
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
          name="password"
          type="password"
          autoComplete="new-password"
          required
          requiredText={words.required}
          showPasswordLabel={words.showPassword}
          label={words.password}
          hint={words.passwordHint}
          error={error}
        />
        <Button type="submit" className="mt-2 w-full" disabled={busy || waiting}>
          {words.submit}
        </Button>
      </form>
    </>
  );
}
