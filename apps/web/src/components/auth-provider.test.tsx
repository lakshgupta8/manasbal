import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as auth from "@/lib/auth";
import {
  AuthProvider,
  MIN_RENEW_SECONDS,
  RENEW_EARLY_SECONDS,
  renewOnce,
  useAuth,
} from "./auth-provider";

vi.mock("@/lib/auth", () => ({ refresh: vi.fn(), me: vi.fn(), signOut: vi.fn() }));

const refresh = vi.mocked(auth.refresh);
const me = vi.mocked(auth.me);
const signOut = vi.mocked(auth.signOut);

const SESSION = { accessToken: "first", expiresIn: 900 };
const USER = { id: "u1", email: "customer@example.com", name: "Demo Customer", role: "customer" };

function Status() {
  const { state } = useAuth();
  return (
    <p>
      {state.status === "signedIn" ? `${state.user.name} with ${state.accessToken}` : state.status}
    </p>
  );
}

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

beforeEach(() => {
  me.mockResolvedValue(USER);
  signOut.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("AuthProvider", () => {
  it("is loading, then signed in from the refresh cookie, with the token in memory only", async () => {
    refresh.mockResolvedValue(SESSION);
    const stored = vi.spyOn(Storage.prototype, "setItem");

    render(<Status />, { wrapper });

    expect(screen.getByText("loading")).toBeDefined();
    expect(await screen.findByText("Demo Customer with first")).toBeDefined();
    expect(me).toHaveBeenCalledWith("first");
    expect(stored).not.toHaveBeenCalled();
    expect(document.cookie).toBe("");
  });

  it("is signed out without a usable cookie", async () => {
    refresh.mockResolvedValue(null);

    render(<Status />, { wrapper });

    expect(await screen.findByText("signedOut")).toBeDefined();
    expect(me).not.toHaveBeenCalled();
  });

  it("is signed out when the API can't be reached", async () => {
    refresh.mockRejectedValue(new Error("offline"));

    render(<Status />, { wrapper });

    expect(await screen.findByText("signedOut")).toBeDefined();
  });

  it("is signed out when it can't find out who the session belongs to", async () => {
    refresh.mockResolvedValue(SESSION);
    me.mockRejectedValue(new Error("401"));

    render(<Status />, { wrapper });

    expect(await screen.findByText("signedOut")).toBeDefined();
  });

  it("spends the refresh cookie once even when the effect runs twice", async () => {
    refresh.mockResolvedValue(SESSION);

    const { unmount } = render(<Status />, { wrapper });
    render(<Status />, { wrapper });
    unmount();

    await waitFor(() => expect(me).toHaveBeenCalled());
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shares one renewal between callers, and starts a new one after it ends", async () => {
    refresh.mockResolvedValue(SESSION);

    const [a, b] = [renewOnce(), renewOnce()];
    expect(a).toBe(b);
    await a;
    await renewOnce();

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("renews the token a minute before it expires", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    refresh
      .mockResolvedValueOnce(SESSION)
      .mockResolvedValueOnce({ ...SESSION, accessToken: "second" });

    render(<Status />, { wrapper });
    await screen.findByText("Demo Customer with first");

    await act(async () => {
      await vi.advanceTimersByTimeAsync((SESSION.expiresIn - RENEW_EARLY_SECONDS) * 1000);
    });

    expect(await screen.findByText("Demo Customer with second")).toBeDefined();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("waits at least a little before renewing a short-lived token, and signs out if renewal fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    refresh
      .mockResolvedValueOnce({ accessToken: "short", expiresIn: 5 })
      .mockRejectedValueOnce(new Error("offline"));

    render(<Status />, { wrapper });
    await screen.findByText("Demo Customer with short");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MIN_RENEW_SECONDS * 1000 - 100);
    });
    expect(refresh).toHaveBeenCalledOnce();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(await screen.findByText("signedOut")).toBeDefined();
  });

  it("keeps a new session after sign-in", async () => {
    refresh.mockResolvedValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.status).toBe("signedOut"));

    await act(() => result.current.signedIn({ accessToken: "fresh", expiresIn: 900 }));

    expect(result.current.state).toEqual({
      status: "signedIn",
      accessToken: "fresh",
      expiresIn: 900,
      user: USER,
    });
  });

  it("signs out through the API and forgets the token", async () => {
    refresh.mockResolvedValue(SESSION);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.status).toBe("signedIn"));

    await act(() => result.current.signOut());

    expect(signOut).toHaveBeenCalledOnce();
    expect(result.current.state).toEqual({ status: "signedOut" });
  });

  it("forgets the token even when sign-out can't reach the API", async () => {
    refresh.mockResolvedValue(SESSION);
    signOut.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.status).toBe("signedIn"));

    await act(() => result.current.signOut());

    expect(result.current.state).toEqual({ status: "signedOut" });
  });
});

describe("useAuth", () => {
  it("needs an AuthProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => renderHook(() => useAuth())).toThrow("useAuth needs an AuthProvider around it");
  });
});
