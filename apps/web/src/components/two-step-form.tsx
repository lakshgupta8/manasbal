import { Button, TextField } from "@manasbal/ui";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { verifyTwoStep, type Session, type TwoStepOutcome } from "@/lib/auth";
import { FormAlert, type TooManyTriesWords } from "./auth-form-parts";
import { useFormAlert } from "./use-form-alert";

export interface TwoStepWords extends TooManyTriesWords {
  readonly title: string;
  readonly codeLabel: string;
  readonly codeHint: string;
  readonly recoveryLabel: string;
  readonly recoveryHint: string;
  readonly submit: string;
  readonly useRecoveryCode: string;
  readonly useApp: string;
  readonly codeMissing: string;
  readonly recoveryMissing: string;
  readonly wrongCode: string;
  readonly wrongRecoveryCode: string;
  readonly unavailable: string;
}

export interface TwoStepFormProps {
  readonly words: TwoStepWords;
  // From sign-in: it works for 5 minutes and allows 5 wrong codes.
  readonly challengeToken: string;
  readonly onSignedIn: (session: Session) => Promise<void>;
  // The challenge can't be used any more: back to the password.
  readonly onSignInAgain: () => void;
}

type Kind = "code" | "recovery";

// Six digits, spaces allowed (apps show "123 456"); a recovery code is checked by the API.
const SIX_DIGITS = /^\d{6}$/;

function codeField(form: HTMLFormElement | null): HTMLInputElement {
  return form?.elements.namedItem("code") as HTMLInputElement;
}

// The second step of sign-in: the 6-digit code from the authenticator app, or one of the recovery
// codes, sent with the challenge sign-in answered.
export function TwoStepForm({
  words,
  challengeToken,
  onSignedIn,
  onSignInAgain,
}: TwoStepFormProps) {
  const form = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<Kind>("code");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const { alert, waiting, show, tooManyTries } = useFormAlert(words);

  // The field takes the focus when the step opens and when it switches between the two kinds
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

  async function explain(outcome: TwoStepOutcome) {
    switch (outcome.kind) {
      case "signedIn":
        await onSignedIn(outcome.session);
        return;
      case "wrongCode":
        showError(kind === "code" ? words.wrongCode : words.wrongRecoveryCode);
        return;
      case "signInAgain":
        onSignInAgain();
        return;
      case "tooManyTries":
        tooManyTries(outcome.retryAfterSeconds);
        return;
    }
  }

  async function send(code: string) {
    setBusy(true);
    setError(undefined);
    show(null);
    try {
      await explain(await verifyTwoStep(challengeToken, code));
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
          {words.submit}
        </Button>
      </form>
      <div>
        <button type="button" onClick={switchKind} className="text-text-action underline">
          {kind === "code" ? words.useRecoveryCode : words.useApp}
        </button>
      </div>
    </>
  );
}
