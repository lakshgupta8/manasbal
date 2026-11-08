import { useEffect, useState } from "react";
import { DEFAULT_WAIT_SECONDS, tooManyTriesText, type TooManyTriesWords } from "./auth-form-parts";

export interface FormAlert {
  // The alert under the title, or null for none.
  readonly alert: string | null;
  // True while the form must wait after too many tries.
  readonly waiting: boolean;
  readonly show: (message: string | null) => void;
  // Says how long to wait, and waits that long (a minute when the API didn't say).
  readonly tooManyTries: (retryAfterSeconds?: number) => void;
}

// The alert every sign-in form shows under its title, and the wait after too many tries: the
// alert goes and the button can be pressed again once the wait is over.
export function useFormAlert(words: TooManyTriesWords): FormAlert {
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

  return {
    alert,
    waiting: waitUntil !== null,
    show: setAlert,
    tooManyTries: (seconds) => {
      setAlert(tooManyTriesText(words, seconds));
      setWaitUntil(Date.now() + (seconds ?? DEFAULT_WAIT_SECONDS) * 1000);
    },
  };
}
