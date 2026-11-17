import type { Session } from "@manasbal/types";
import { reach, refusal, unexpected, type Listed, type Refusal } from "./auth";

// Where the signed-in visitor is signed in (/me/sessions), from the browser with the access token
// the auth context keeps in memory. Plain fetch, like lib/addresses.ts.

export type SignedInBrowser = Session;

export type SessionsOutcome = Listed<SignedInBrowser> | Refusal;

// One entry per signed-in browser, most recently used first; `current` marks this one.
export async function listSessions(accessToken: string): Promise<SessionsOutcome> {
  const { data, response } = await reach("/me/sessions", { method: "GET", accessToken });
  if (response.ok) return { kind: "listed", items: data as SignedInBrowser[] };
  const refused = refusal(response);
  if (refused) return refused;
  throw unexpected(response);
}

// Signs that browser out. A session that has already ended counts as ended.
export async function endSession(
  accessToken: string,
  id: string,
): Promise<{ readonly kind: "ended" } | Refusal> {
  const { response } = await reach(`/me/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    accessToken,
  });
  if (response.status === 204 || response.status === 404) return { kind: "ended" };
  const refused = refusal(response);
  if (refused) return refused;
  throw unexpected(response);
}
