import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountMenu } from "./account-menu";
import { useAuth, type AuthContextValue } from "./auth-provider";

vi.mock("./auth-provider", () => ({ useAuth: vi.fn() }));

const signOut = vi.fn(async () => undefined);

function signed(state: AuthContextValue["state"]) {
  vi.mocked(useAuth).mockReturnValue({ state, signOut, signedIn: vi.fn() });
}

const menu = (
  <AccountMenu
    signInHref="/en/sign-in"
    signInLabel="Sign in"
    signOutLabel="Sign out"
    signedInAs="Signed in as {name}"
  />
);

afterEach(() => {
  vi.resetAllMocks();
});

describe("AccountMenu", () => {
  it.each(["loading", "signedOut"] as const)("links to sign-in while %s", (status) => {
    signed({ status });

    render(menu);

    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/en/sign-in");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says who is signed in, with a button that signs out", () => {
    signed({
      status: "signedIn",
      accessToken: "t",
      expiresIn: 900,
      user: { id: "u1", email: "seller@example.com", name: "Demo Seller", role: "seller" },
    });

    render(menu);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(screen.getByText("Signed in as Demo Seller")).toBeDefined();
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(signOut).toHaveBeenCalledOnce();
  });
});
