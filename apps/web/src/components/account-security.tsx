"use client";

import { isDemoEmail } from "@manasbal/types/demo-logins";
import { Button, ConfirmDialog } from "@manasbal/ui";
import { useState, type ReactNode } from "react";
import { endSession, listSessions, type SignedInBrowser } from "@/lib/sessions";
import {
  disableTwoStep,
  enableTwoStep,
  startTwoStep,
  type SwitchOutcome,
  type TwoStepSetup,
} from "@/lib/two-step";
import { useAccountPage, type AccountWords } from "./account-pages";
import { FormAlert } from "./auth-form-parts";
import { useAuth } from "./auth-provider";
import { QrCode } from "./qr-code";
import { CodeForm, DONE, type CodeCheck } from "./two-step-form";

// The account's security pages, sessions and two-step sign-in, built like the address book: words
// and fixed states come from the server, everything else from the API with the access token in
// memory. The two-step secret and recovery codes live only in this page's state, and are dropped
// as soon as they are no longer shown.

// Fixed states drawn on the server.
export interface SessionStates {
  readonly loading: ReactNode;
  readonly listLoading: ReactNode;
  readonly loadFailed: ReactNode;
}

export interface SessionListProps {
  readonly words: AccountWords;
  readonly locale: string;
  readonly signInHref: string;
  readonly states: SessionStates;
}

// Every browser signed in to the account, this one marked, each with "End session" behind a
// question. Ending this browser's own session signs it out and goes to sign-in.
export function SessionList({ words, locale, signInHref, states }: SessionListProps) {
  const page = useAccountPage(words, signInHref, listSessions);
  const { signedIn, items: sessions } = page;
  const { signOut } = useAuth();
  const [ending, setEnding] = useState<SignedInBrowser | null>(null);

  const end = (session: SignedInBrowser) =>
    page.run(async () => {
      const outcome = await endSession(signedIn!.accessToken, session.id);
      setEnding(null);
      if (outcome.kind !== "ended") return page.refused(outcome);
      // This browser's own session: its refresh cookie no longer works, so it signs out here too,
      // and the page sends it to sign in.
      if (session.current) return signOut();
      page.setItems(sessions!.filter((other) => other.id !== session.id));
      page.done(words.ended);
    });

  if (signedIn === null) return states.loading;
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const at = (text: string, iso: string) => text.replace("{date}", when.format(new Date(iso)));

  let main: ReactNode;
  if (page.failed) main = states.loadFailed;
  else if (sessions === null) main = states.listLoading;
  else {
    main = (
      <ul className="flex flex-col gap-4 max-w-xl">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="flex flex-col gap-2 p-4 border border-border-strong rounded-lg text-body"
          >
            <h2 className="font-semibold">
              {session.browser}
              {session.current && ` (${words.thisDevice})`}
            </h2>
            <p className="text-text-muted">{at(words.startedAt, session.startedAt)}</p>
            <p className="text-text-muted">{at(words.lastUsedAt, session.lastUsedAt)}</p>
            <div>
              <Button
                variant="secondary"
                size="sm"
                aria-label={words.endSessionNamed.replace("{browser}", session.browser)}
                onClick={() => setEnding(session)}
              >
                {words.endSession}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <Heading
        heading={page.heading}
        alert={page.alert}
        status={page.status}
        text={words.sessionsTitle}
      />
      <p className="text-body text-text-muted">{words.sessionsIntro}</p>
      {main}
      <ConfirmDialog
        open={ending !== null}
        title={words.endTitle}
        confirmLabel={words.endSession}
        cancelLabel={words.keep}
        busy={page.busy}
        onConfirm={() => void end(ending!)}
        onCancel={() => setEnding(null)}
      >
        <p>
          {ending?.current
            ? words.endCurrentBody
            : words.endBody.replace("{browser}", ending?.browser ?? "")}
        </p>
      </ConfirmDialog>
    </>
  );
}

type HeadingProps = Pick<ReturnType<typeof useAccountPage>, "heading" | "alert" | "status"> & {
  readonly text: string;
};

// The page heading (focus comes back to it after a result), then the alert and the status line.
function Heading({ heading, alert, status, text }: HeadingProps) {
  return (
    <>
      <h1 ref={heading} tabIndex={-1} className="font-semibold text-heading-2 focus:outline-none">
        {text}
      </h1>
      {alert !== null && <FormAlert>{alert}</FormAlert>}
      <output className="text-body empty:hidden">{status}</output>
    </>
  );
}

export interface TwoStepStates {
  readonly loading: ReactNode;
  // "Two-step sign-in is off for demo logins", drawn on the server.
  readonly demo: ReactNode;
}

export interface TwoStepSettingsProps {
  readonly words: AccountWords;
  readonly signInHref: string;
  readonly states: TwoStepStates;
}

// Where switching on has got to: started (the secret is shown) or done (the recovery codes are).
type Step = TwoStepSetup | readonly string[] | null;

// Two-step sign-in, on or off as GET /me says. Switching on shows the secret as a QR code and as
// text, takes a code from the app, then shows the recovery codes once. Switching off takes a code
// or a recovery code. Demo logins can't switch it on, so they get a message and no switch.
export function TwoStepSettings({ words, signInHref, states }: TwoStepSettingsProps) {
  const page = useAccountPage(words, signInHref);
  const { refreshUser } = useAuth();
  const [step, setStep] = useState<Step>(null);
  const [demo, setDemo] = useState(false);

  if (page.signedIn === null) return states.loading;
  const { accessToken, user } = page.signedIn;

  // Back to the plain page (the secret and codes dropped), showing the state GET /me now answers,
  // with the result said and focus on the heading.
  async function settled(message: string) {
    setStep(null);
    await refreshUser();
    page.done(message);
  }

  // A switch the API didn't make: a wrong code or a wait (the form says those), changed
  // elsewhere meanwhile, or signed out.
  async function notSwitched(outcome: SwitchOutcome): Promise<CodeCheck> {
    if (outcome.kind === "changed") await settled(words.changedElsewhere);
    else if (outcome.kind === "signedOut") page.refused(outcome);
    else return outcome;
    return DONE;
  }

  const start = () =>
    page.run(async () => {
      const outcome = await startTwoStep(accessToken);
      if (outcome.kind === "started") {
        setStep(outcome.setup);
        page.done("");
      } else if (outcome.kind === "demo") setDemo(true);
      else if (outcome.kind === "alreadyOn") await settled(words.changedElsewhere);
      else page.refused(outcome);
    });

  async function enable(code: string): Promise<CodeCheck> {
    const outcome = await enableTwoStep(accessToken, code);
    if (outcome.kind !== "on") return notSwitched(outcome);
    setStep(outcome.recoveryCodes);
    await refreshUser();
    page.done("");
    return DONE;
  }

  async function disable(code: string): Promise<CodeCheck> {
    const outcome = await disableTwoStep(accessToken, code);
    if (outcome.kind !== "off") return notSwitched(outcome);
    await settled(words.twoStepIsOff);
    return DONE;
  }

  let main: ReactNode;
  if (demo || isDemoEmail(user.email)) main = states.demo;
  else if (Array.isArray(step)) {
    main = (
      <>
        <h2 className="font-semibold text-heading-3">{words.codesTitle}</h2>
        <p>{words.codesBody}</p>
        <ul className="gap-2 grid grid-cols-2 p-4 border border-border-strong rounded-lg w-fit font-mono">
          {step.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <div>
          <Button onClick={() => void settled(words.twoStepIsOn)}>{words.codesDone}</Button>
        </div>
      </>
    );
  } else if (step !== null) {
    const { otpauthUrl, secret } = step as TwoStepSetup;
    main = (
      <>
        <h2 className="font-semibold text-heading-3">{words.setupTitle}</h2>
        <p>{words.setupScan}</p>
        <QrCode text={otpauthUrl} label={words.qrLabel} />
        <p>
          {words.setupKey}{" "}
          <code className="font-mono font-semibold break-all">
            {secret.replace(/(.{4})(?=.)/g, "$1 ")}
          </code>
        </p>
        <CodeForm words={words} submit={words.confirmOn} check={enable} recovery={false} />
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              setStep(null);
              page.done("");
            }}
          >
            {words.cancel}
          </Button>
        </div>
      </>
    );
  } else if (user.twoStep) {
    main = (
      <>
        <p>{words.twoStepIsOn}</p>
        <h2 className="font-semibold text-heading-3">{words.switchOffTitle}</h2>
        <CodeForm words={words} submit={words.switchOff} check={disable} />
      </>
    );
  } else {
    main = (
      <>
        <p>{words.twoStepIsOff}</p>
        <div>
          <Button disabled={page.busy || page.waiting} onClick={() => void start()}>
            {words.switchOn}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <Heading
        heading={page.heading}
        alert={page.alert}
        status={page.status}
        text={words.twoStepTitle}
      />
      <div className="flex flex-col gap-4 max-w-96 text-body">
        <p className="text-text-muted">{words.twoStepIntro}</p>
        {main}
      </div>
    </>
  );
}
