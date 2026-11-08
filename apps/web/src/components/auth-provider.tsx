"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as auth from "@/lib/auth";
import type { Me, Session } from "@/lib/auth";

export type AuthState =
  | { readonly status: "loading" }
  | { readonly status: "signedOut" }
  | {
      readonly status: "signedIn";
      readonly accessToken: string;
      // Seconds the access token was given to live.
      readonly expiresIn: number;
      readonly user: Me;
    };

export interface AuthContextValue {
  readonly state: AuthState;
  // After sign-in answered a session: looks up who it is and keeps the token in memory.
  readonly signedIn: (session: Session) => Promise<void>;
  readonly signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// The access token is renewed this many seconds before it expires.
export const RENEW_EARLY_SECONDS = 60;
// And never sooner than this, so a short-lived token can't make it loop.
export const MIN_RENEW_SECONDS = 10;

// Each refresh cookie works once, and using one twice signs out every copy. One renewal at a
// time is shared by everyone who asks, so React running an effect twice can't spend the cookie
// twice.
let renewing: Promise<Session | null> | null = null;

export function renewOnce(): Promise<Session | null> {
  renewing ??= auth.refresh().finally(() => {
    renewing = null;
  });
  return renewing;
}

const SIGNED_OUT: AuthState = { status: "signedOut" };

// The state a session leads to: signed in as whoever it belongs to, or signed out without one.
async function stateFor(session: Session | null): Promise<AuthState> {
  if (session === null) return SIGNED_OUT;
  try {
    const user = await auth.me(session.accessToken);
    return {
      status: "signedIn",
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      user,
    };
  } catch {
    return SIGNED_OUT;
  }
}

// Who is signed in, with the access token in memory only (never in storage, which scripts can
// read). On load it renews the session from the refresh cookie, and it renews it again before
// the token expires.
export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  // On load: the refresh cookie, if there is a usable one, says who is signed in.
  useEffect(() => {
    let current = true;
    renewOnce()
      .then(stateFor, () => SIGNED_OUT)
      .then((next) => {
        if (current) setState(next);
      });
    return () => {
      current = false;
    };
  }, []);

  // While signed in: a new access token shortly before this one expires.
  const expiresIn = state.status === "signedIn" ? state.expiresIn : null;
  useEffect(() => {
    if (expiresIn === null) return;
    const seconds = Math.max(MIN_RENEW_SECONDS, expiresIn - RENEW_EARLY_SECONDS);
    const timer = setTimeout(() => {
      renewOnce()
        .then(stateFor, () => SIGNED_OUT)
        .then(setState);
    }, seconds * 1000);
    return () => clearTimeout(timer);
  }, [state, expiresIn]);

  const signedIn = useCallback(async (session: Session) => {
    setState(await stateFor(session));
  }, []);

  const signOut = useCallback(async () => {
    // Signed out here even if the API can't be reached: the token is gone from memory, and the
    // cookie's session ends on its own.
    await auth.signOut().catch(() => undefined);
    setState(SIGNED_OUT);
  }, []);

  const value = useMemo(() => ({ state, signedIn, signOut }), [state, signedIn, signOut]);
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) throw new Error("useAuth needs an AuthProvider around it");
  return value;
}
