import type { Address, AddressInput } from "@manasbal/types";
import { reach, retryAfterSeconds, unexpected } from "./auth";

// The signed-in visitor's delivery addresses (/me/addresses), from the browser with the access
// token the auth context keeps in memory. Like lib/auth.ts, plain fetch rather than the typed
// client, which keeps that client out of the browser's bundle.

export type { Address, AddressInput } from "@manasbal/types";

// What a call came to besides its answer. "signedOut": the token was refused, so the page sends
// the visitor to sign in again. Anything else unexpected throws.
export type Refusal =
  | { readonly kind: "signedOut" }
  | { readonly kind: "tooManyTries"; readonly retryAfterSeconds?: number };

function refusal(response: Response): Refusal | undefined {
  if (response.status === 401) return { kind: "signedOut" };
  if (response.status === 429) {
    return {
      kind: "tooManyTries",
      retryAfterSeconds: retryAfterSeconds(response.headers.get("retry-after")),
    };
  }
  return undefined;
}

export type ListOutcome = { readonly kind: "listed"; readonly addresses: Address[] } | Refusal;

// Every address, the default one first (as the API sorts them).
export async function listAddresses(accessToken: string): Promise<ListOutcome> {
  const { data, response } = await reach("/me/addresses", { method: "GET", accessToken });
  if (response.ok) return { kind: "listed", addresses: data as Address[] };
  const refused = refusal(response);
  if (refused) return refused;
  throw unexpected(response);
}

// "invalid": the API refused the details (the form checks them first, so rarely). "gone": the
// address being changed no longer exists.
export type SaveOutcome =
  | { readonly kind: "saved"; readonly address: Address }
  | { readonly kind: "invalid" }
  | { readonly kind: "gone" }
  | Refusal;

// Adds an address, or changes the one with this id.
export async function saveAddress(
  accessToken: string,
  input: AddressInput,
  id?: string,
): Promise<SaveOutcome> {
  const { data, response } = await reach(
    id === undefined ? "/me/addresses" : `/me/addresses/${encodeURIComponent(id)}`,
    { method: id === undefined ? "POST" : "PATCH", body: input, accessToken },
  );
  if (response.ok) return { kind: "saved", address: data as Address };
  if (response.status === 400) return { kind: "invalid" };
  if (response.status === 404) return { kind: "gone" };
  const refused = refusal(response);
  if (refused) return refused;
  throw unexpected(response);
}

// "inUse": an order was sent to it, so it stays. An address that is already gone counts as
// deleted.
export type DeleteOutcome = { readonly kind: "deleted" } | { readonly kind: "inUse" } | Refusal;

export async function deleteAddress(accessToken: string, id: string): Promise<DeleteOutcome> {
  const { response } = await reach(`/me/addresses/${encodeURIComponent(id)}`, {
    method: "DELETE",
    accessToken,
  });
  if (response.status === 204 || response.status === 404) return { kind: "deleted" };
  if (response.status === 409) return { kind: "inUse" };
  const refused = refusal(response);
  if (refused) return refused;
  throw unexpected(response);
}
