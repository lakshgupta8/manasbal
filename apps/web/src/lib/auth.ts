import type { ApiClient } from "@manasbal/sdk";
import { ApiResponseError, ApiUnavailableError, apiClient } from "./api";

// The browser's side of signing in. Every call goes through the shop's own address (ADR 0012),
// so the refresh cookie stays first-party, and the access token is only ever returned, never
// stored: the auth context keeps it in memory.

export interface Session {
  readonly accessToken: string;
  // Seconds until the access token expires.
  readonly expiresIn: number;
}

export interface Me {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: string;
}

// What signing in came to. Each failure is one the page explains in words next to the right
// field; anything else throws.
export type SignInOutcome =
  | { readonly kind: "signedIn"; readonly session: Session }
  | { readonly kind: "twoStep"; readonly challengeToken: string }
  | { readonly kind: "wrongPassword" }
  | { readonly kind: "notConfirmed" }
  | { readonly kind: "invalid" }
  | { readonly kind: "tooManyTries"; readonly retryAfterSeconds?: number };

interface Answer {
  readonly data?: unknown;
  readonly response: Response;
}

// One call from the browser; a network failure or timeout becomes ApiUnavailableError.
async function reach<T extends Answer>(call: (api: ApiClient) => Promise<T>, token?: string) {
  try {
    return await call(apiClient(token));
  } catch (error) {
    throw new ApiUnavailableError("The API could not be reached", { cause: error });
  }
}

function unexpected(response: Response): ApiResponseError {
  return new ApiResponseError(response.status, response.statusText);
}

// Retry-After is either whole seconds or an HTTP date. Undefined when it is missing or neither.
export function retryAfterSeconds(value: string | null, now: number = Date.now()) {
  if (value === null) return undefined;
  const text = value.trim();
  if (/^\d+$/.test(text)) return Number(text);
  // Otherwise only an HTTP date counts, and it has letters (the day and month names).
  const at = /[a-z]/i.test(text) ? Date.parse(text) : Number.NaN;
  return Number.isNaN(at) ? undefined : Math.max(0, Math.ceil((at - now) / 1000));
}

export async function signIn(email: string, password: string): Promise<SignInOutcome> {
  const { data, response } = await reach((api) =>
    api.POST("/auth/sign-in", { body: { email, password } }),
  );
  switch (response.status) {
    case 200:
      return data !== undefined && "challengeToken" in data
        ? { kind: "twoStep", challengeToken: data.challengeToken }
        : { kind: "signedIn", session: data as Session };
    case 400:
      return { kind: "invalid" };
    case 401:
      return { kind: "wrongPassword" };
    case 403:
      return { kind: "notConfirmed" };
    case 429:
      return {
        kind: "tooManyTries",
        retryAfterSeconds: retryAfterSeconds(response.headers.get("retry-after")),
      };
    default:
      throw unexpected(response);
  }
}

// Swaps the refresh cookie for a new session, or answers null when there is no usable one.
export async function refresh(): Promise<Session | null> {
  const { data, response } = await reach((api) => api.POST("/auth/refresh"));
  if (response.ok) return data as Session;
  if (response.status === 401 || response.status === 403) return null;
  throw unexpected(response);
}

export async function signOut(): Promise<void> {
  const { response } = await reach((api) => api.POST("/auth/sign-out"));
  if (!response.ok) throw unexpected(response);
}

export async function me(accessToken: string): Promise<Me> {
  const { data, response } = await reach((api) => api.GET("/me"), accessToken);
  if (!response.ok) throw unexpected(response);
  return data as Me;
}
