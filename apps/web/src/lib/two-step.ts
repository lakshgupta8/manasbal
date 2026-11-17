import type { TwoStepSetup } from "@manasbal/types";
import { reach, refusal, unexpected, type Refusal } from "./auth";

// Switching two-step sign-in on and off (/auth/2fa/*), from the browser with the access token the
// auth context keeps in memory. Plain fetch, like lib/addresses.ts. The secret and the recovery
// codes are only ever returned to the page, never stored or logged.

export type { TwoStepSetup } from "@manasbal/types";

// "demo": two-step is off for demo logins. "alreadyOn": it was switched on elsewhere meanwhile.
export type SetupOutcome =
  | { readonly kind: "started"; readonly setup: TwoStepSetup }
  | { readonly kind: "demo" }
  | { readonly kind: "alreadyOn" }
  | Refusal;

// A new secret for the authenticator app; two-step is not on until enable gets a code.
export async function startTwoStep(accessToken: string): Promise<SetupOutcome> {
  const { data, response } = await reach("/auth/2fa/setup", { accessToken });
  if (response.ok) return { kind: "started", setup: data as TwoStepSetup };
  if (response.status === 403) return { kind: "demo" };
  if (response.status === 409) return { kind: "alreadyOn" };
  const refused = refusal(response);
  if (refused) return refused;
  throw unexpected(response);
}

// "wrongCode": the code is not right (or set-up has to start again). "changed": two-step was
// already switched the other way, elsewhere.
export type SwitchOutcome = { readonly kind: "wrongCode" } | { readonly kind: "changed" } | Refusal;

// Switches two-step on with a code from the app; answers the recovery codes, shown only once.
export async function enableTwoStep(
  accessToken: string,
  code: string,
): Promise<{ readonly kind: "on"; readonly recoveryCodes: string[] } | SwitchOutcome> {
  const { data, response } = await reach("/auth/2fa/enable", { body: { code }, accessToken });
  if (response.ok) {
    return { kind: "on", recoveryCodes: (data as { recoveryCodes: string[] }).recoveryCodes };
  }
  return switchRefused(response);
}

// Switches two-step off with a code from the app, or a recovery code.
export async function disableTwoStep(
  accessToken: string,
  code: string,
): Promise<{ readonly kind: "off" } | SwitchOutcome> {
  const { response } = await reach("/auth/2fa/disable", { body: { code }, accessToken });
  if (response.ok) return { kind: "off" };
  return switchRefused(response);
}

function switchRefused(response: Response): SwitchOutcome {
  if (response.status === 400) return { kind: "wrongCode" };
  if (response.status === 409) return { kind: "changed" };
  const refused = refusal(response);
  if (refused) return refused;
  throw unexpected(response);
}
