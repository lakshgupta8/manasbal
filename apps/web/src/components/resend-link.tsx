import { Button } from "@manasbal/ui";
import { useEffect, useState } from "react";
import { resendVerification } from "@/lib/auth";
import { FormAlert, type TooManyTriesWords } from "./auth-form-parts";
import { useFormAlert } from "./use-form-alert";

// After a click the button rests this long, so a visitor can't fire off a burst of mails.
export const RESEND_PAUSE_MS = 30_000;

export interface ResendWords extends TooManyTriesWords {
  readonly resend: string;
  readonly resendSent: string;
  readonly unavailable: string;
}

export interface ResendLinkProps {
  readonly email: string;
  readonly words: ResendWords;
}

// "Send the link again" under "Check your email". Whatever happens, it says the same thing ("If
// this email has an unconfirmed account, a new link is on its way"), as the API answers the same.
// Too many tries waits as long as Retry-After says, like the other forms.
export function ResendLink({ email, words }: ResendLinkProps) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [resting, setResting] = useState(false);
  const { alert, waiting, show, tooManyTries } = useFormAlert(words);

  useEffect(() => {
    if (!resting) return;
    const timer = setTimeout(() => setResting(false), RESEND_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [resting]);

  async function resend() {
    setBusy(true);
    show(null);
    setSent(false);
    try {
      const outcome = await resendVerification(email);
      if (outcome.kind === "sent") {
        setSent(true);
        setResting(true);
      } else tooManyTries(outcome.retryAfterSeconds);
    } catch {
      show(words.unavailable);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {alert !== null && <FormAlert>{alert}</FormAlert>}
      {sent && <output className="block">{words.resendSent}</output>}
      <Button
        variant="secondary"
        aria-busy={busy}
        disabled={busy || resting || waiting}
        onClick={() => void resend()}
      >
        {words.resend}
      </Button>
    </div>
  );
}
