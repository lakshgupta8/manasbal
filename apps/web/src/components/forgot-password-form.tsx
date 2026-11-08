import { Button, TextField } from "@manasbal/ui";
import { useRef, useState, type FormEvent } from "react";
import { forgotPassword } from "@/lib/auth";
import { CardLink, FormAlert, looksLikeEmail, type TooManyTriesWords } from "./auth-form-parts";
import { useFormAlert } from "./use-form-alert";

export interface ForgotPasswordWords extends TooManyTriesWords {
  readonly title: string;
  readonly intro: string;
  readonly email: string;
  readonly emailHint: string;
  readonly submit: string;
  readonly backToSignIn: string;
  readonly emailMissing: string;
  readonly emailInvalid: string;
  readonly sent: string;
  readonly unavailable: string;
}

export interface ForgotPasswordFormProps {
  readonly words: ForgotPasswordWords;
  readonly signInHref: string;
}

// Asks for a reset link. Whatever the email, it then says the same thing ("If this email has an
// account, a link is on its way"), so the page never tells whether an account exists.
export function ForgotPasswordForm({ words, signInHref }: ForgotPasswordFormProps) {
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [sent, setSent] = useState(false);
  const { alert, waiting, show, tooManyTries } = useFormAlert(words);

  async function send(email: string) {
    setBusy(true);
    show(null);
    try {
      const outcome = await forgotPassword(email);
      if (outcome.kind === "sent") setSent(true);
      else tooManyTries(outcome.retryAfterSeconds);
    } catch {
      show(words.unavailable);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = (new FormData(event.currentTarget).get("email") as string).trim();
    let problem: string | undefined;
    if (email === "") problem = words.emailMissing;
    else if (!looksLikeEmail(email)) problem = words.emailInvalid;
    setError(problem);
    if (problem === undefined) void send(email);
    else (form.current?.elements.namedItem("email") as HTMLInputElement).focus();
  }

  return (
    <>
      <h1 className="font-semibold text-heading-2">{words.title}</h1>
      {alert !== null && <FormAlert>{alert}</FormAlert>}
      {sent ? (
        <output className="block">{words.sent}</output>
      ) : (
        <>
          <p className="text-text-muted">{words.intro}</p>
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
              autoComplete="email"
              label={words.email}
              hint={words.emailHint}
              error={error}
            />
            <Button type="submit" className="mt-2 w-full" disabled={busy || waiting}>
              {words.submit}
            </Button>
          </form>
        </>
      )}
      <div>
        <CardLink href={signInHref}>{words.backToSignIn}</CardLink>
      </div>
    </>
  );
}
