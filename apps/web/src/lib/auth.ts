import type { SignInInput, SignUpInput } from "@manasbal/types";
import { API_TIMEOUT_MS, ApiResponseError, ApiUnavailableError } from "./api-errors";
import { shopPath } from "./api-routes";

// The browser's side of signing in. Every call goes through the shop's own address (ADR 0012),
// so the refresh cookie stays first-party, and the access token is only ever returned, never
// stored: the auth context keeps it in memory. These few calls use fetch itself rather than the
// typed client in api.ts, which keeps that client out of the browser's bundle; the request
// bodies are still typed from @manasbal/types.

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

interface CallOptions {
  readonly method?: "GET" | "POST";
  readonly body?: object;
  readonly accessToken?: string;
}

// A JSON answer's body, or undefined when there is none (204) or it isn't JSON.
async function bodyOf(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

// One call from the browser to the API path `path`; a network failure or timeout becomes
// ApiUnavailableError.
async function reach(path: string, { method = "POST", body, accessToken }: CallOptions = {}) {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  if (accessToken !== undefined) headers.set("authorization", `Bearer ${accessToken}`);
  let response: Response;
  try {
    response = await fetch(
      new Request(new URL(shopPath(path), window.location.origin), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      }),
    );
  } catch (error) {
    throw new ApiUnavailableError("The API could not be reached", { cause: error });
  }
  return { data: await bodyOf(response), response } satisfies Answer;
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
  const body: SignInInput = { email, password };
  const { data, response } = await reach("/auth/sign-in", { body });
  switch (response.status) {
    case 200:
      return typeof data === "object" && data !== null && "challengeToken" in data
        ? { kind: "twoStep", challengeToken: String(data.challengeToken) }
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
  const { data, response } = await reach("/auth/refresh");
  if (response.ok) return data as Session;
  if (response.status === 401 || response.status === 403) return null;
  throw unexpected(response);
}

export async function signOut(): Promise<void> {
  const { response } = await reach("/auth/sign-out");
  if (!response.ok) throw unexpected(response);
}

export async function me(accessToken: string): Promise<Me> {
  const { data, response } = await reach("/me", { method: "GET", accessToken });
  if (!response.ok) throw unexpected(response);
  return data as Me;
}

// What signing up came to: created (and whether it can sign in now, or a link was mailed),
// refused (details the API won't take, or an email that already has an account; it doesn't say
// which), or too many tries.
export type SignUpOutcome =
  | { readonly kind: "created"; readonly emailConfirmed: boolean }
  | { readonly kind: "refused" }
  | { readonly kind: "tooManyTries"; readonly retryAfterSeconds?: number };

export interface SignUpDetails {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

interface SignUpAnswer {
  readonly emailConfirmed: boolean;
}

// Only ever called once the visitor has ticked "I am 18 or older".
export async function signUp(details: SignUpDetails): Promise<SignUpOutcome> {
  // Field by field: the API refuses any field it doesn't know.
  const { name, email, password } = details;
  const body: SignUpInput = { name, email, password, confirmAdult: true };
  const { data, response } = await reach("/auth/sign-up", { body });
  switch (response.status) {
    case 201:
      return { kind: "created", emailConfirmed: (data as SignUpAnswer).emailConfirmed };
    case 400:
      return { kind: "refused" };
    case 429:
      return {
        kind: "tooManyTries",
        retryAfterSeconds: retryAfterSeconds(response.headers.get("retry-after")),
      };
    default:
      throw unexpected(response);
  }
}

// Uses the token from the link in the sign-up mail: true when the email is now confirmed, false
// when the link is not valid any more (used, expired or unknown).
export async function verifyEmail(token: string): Promise<boolean> {
  const { response } = await reach("/auth/verify-email", { body: { token } });
  if (response.ok) return true;
  if (response.status === 400) return false;
  throw unexpected(response);
}
