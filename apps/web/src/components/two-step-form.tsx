import { Button, TextField } from "@manasbal/ui";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { verifyTwoStep, type Session } from "@/lib/auth";
import { FormAlert, type TooManyTriesWords } from "./auth-form-parts";
import { useFormAlert } from "./use-form-alert";

export interface CodeWords extends TooManyTriesWords {
  readonly codeLabel: string;
  readonly codeHint: string;
  readonly recoveryLabel: string;
  readonly recoveryHint: string;
  readonly useRecoveryCode: string;
  readonly useApp: string;
  readonly codeMissing: string;
  readonly recoveryMissing: string;
  readonly wrongCode: string;
  readonly wrongRecoveryCode: string;
  readonly unavailable: string;
}

export interface TwoStepWords extends CodeWords {
  readonly title: string;
  readonly submit: string;
}

// What checking a code came to, as far as the form is concerned: a wrong code, a wait, or
// "done" (whoever checked it has acted on the answer).
export type CodeCheck =
  | { readonly kind: "wrongCode" }
  | { readonly kind: "tooManyTries"; readonly retryAfterSeconds?: number }
  | { readonly kind: "done" };

export const DONE: CodeCheck = { kind: "done" };

export interface CodeFormProps {
  readonly words: CodeWords;
  readonly submit: string;
  // Sends the code: the second step of sign-in, or switching two-step on or off.
  readonly check: (code: string) => Promise<CodeCheck>;
  // Whether a recovery code can be used instead (not when switching two-step on).
  readonly recovery?: boolean;
}

type Kind = "code" | "recovery";

// Six digits, spaces allowed (apps show "123 456"); a recovery code is checked by the API.
const SIX_DIGITS = /^\d{6}$/;

function codeField(form: HTMLFormElement | null): HTMLInputElement {
  return form?.elements.namedItem("code") as HTMLInputElement;
}

// A box for the 6-digit code from the authenticator app, or one of the recovery codes, and its
// button. A wrong code is said in words, with an icon, under the box, which takes the focus;
// a wait after too many tries, or the API out of reach, in the alert above it.
export function CodeForm({ words, submit, check, recovery = true }: CodeFormProps) {
  const form = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<Kind>("code");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const { alert, waiting, show, tooManyTries } = useFormAlert(words);

  // The field takes the focus when the form opens and when it switches between the two kinds
  // (each kind is a new, empty field).
  useEffect(() => {
    codeField(form.current).focus();
  }, [kind]);

  function showError(message: string) {
    setError(message);
    codeField(form.current).focus();
  }

  function switchKind() {
    setKind(kind === "code" ? "recovery" : "code");
    setError(undefined);
  }

  async function send(code: string) {
    setBusy(true);
    setError(undefined);
    show(null);
    try {
      const outcome = await check(code);
      if (outcome.kind === "wrongCode") {
        showError(kind === "code" ? words.wrongCode : words.wrongRecoveryCode);
      } else if (outcome.kind === "tooManyTries") tooManyTries(outcome.retryAfterSeconds);
    } catch {
      show(words.unavailable);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = (new FormData(event.currentTarget).get("code") as string).replaceAll(" ", "");
    if (kind === "code" && !SIX_DIGITS.test(code)) return showError(words.codeMissing);
    if (kind === "recovery" && code === "") return showError(words.recoveryMissing);
    void send(code);
  }

  return (
    <>
      {alert !== null && <FormAlert>{alert}</FormAlert>}
      <form
        ref={form}
        noValidate
        aria-busy={busy}
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
      >
        <TextField
          // A new field for each kind, so the browser offers the right keyboard and autofill.
          key={kind}
          name="code"
          autoComplete={kind === "code" ? "one-time-code" : "off"}
          inputMode={kind === "code" ? "numeric" : "text"}
          label={kind === "code" ? words.codeLabel : words.recoveryLabel}
          hint={kind === "code" ? words.codeHint : words.recoveryHint}
          error={error}
        />
        <Button type="submit" className="mt-2 w-full" disabled={busy || waiting}>
          {submit}
        </Button>
      </form>
      {recovery && (
        <div>
          <button type="button" onClick={switchKind} className="text-text-action underline">
            {kind === "code" ? words.useRecoveryCode : words.useApp}
          </button>
        </div>
      )}
    </>
  );
}

export interface TwoStepFormProps {
  readonly words: TwoStepWords;
  // From sign-in: it works for 5 minutes and allows 5 wrong codes.
  readonly challengeToken: string;
  readonly onSignedIn: (session: Session) => Promise<void>;
  // The challenge can't be used any more: back to the password.
  readonly onSignInAgain: () => void;
}

// The second step of sign-in: the 6-digit code from the authenticator app, or one of the recovery
// codes, sent with the challenge sign-in answered.
export function TwoStepForm({
  words,
  challengeToken,
  onSignedIn,
  onSignInAgain,
}: TwoStepFormProps) {
  async function check(code: string): Promise<CodeCheck> {
    const outcome = await verifyTwoStep(challengeToken, code);
    if (outcome.kind === "signedIn") await onSignedIn(outcome.session);
    else if (outcome.kind === "signInAgain") onSignInAgain();
    else return outcome;
    return DONE;
  }

  return (
    <>
      <h1 className="font-semibold text-heading-2">{words.title}</h1>
      <CodeForm words={words} submit={words.submit} check={check} />
    </>
  );
}
