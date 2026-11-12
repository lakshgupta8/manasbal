import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as auth from "@/lib/auth";
import { MESSAGES } from "@/test/intl";
import { checkOnce, VerifyEmail, type VerifyEmailWords } from "./verify-email";

const push = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => search,
}));
vi.mock("@/lib/auth", () => ({ verifyEmail: vi.fn() }));

const verifyEmail = vi.mocked(auth.verifyEmail);
const WORDS: VerifyEmailWords = MESSAGES.en.VerifyEmail;
let tokens = 0;

// A token no other test has used, since checks are shared per token.
function withToken(token = `token-${++tokens}`) {
  search = new URLSearchParams({ token });
  return token;
}

function page() {
  return render(
    <VerifyEmail words={WORDS} signInHref="/en/sign-in" newLinkHref="/en/forgot-password" />,
  );
}

const heading = (name: string) => screen.findByRole("heading", { level: 1, name });

beforeEach(() => {
  withToken();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("VerifyEmail", () => {
  it("checks the link as soon as it opens, then says the email is confirmed", async () => {
    let finish: (confirmed: boolean) => void = () => undefined;
    verifyEmail.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const token = withToken("good-link");
    page();

    expect(screen.getByRole("heading", { name: "Confirming your email…" })).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
    await act(async () => finish(true));

    expect(await heading("Your email is confirmed")).toBeDefined();
    expect(screen.getByText("You can sign in now.")).toBeDefined();
    expect(verifyEmail).toHaveBeenCalledWith(token);
    expect(screen.queryByRole("link", { name: "Back to sign in" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(push).toHaveBeenCalledWith("/en/sign-in");
  });

  it("says the link is not valid any more, with a way to a new one and back to sign-in", async () => {
    verifyEmail.mockResolvedValue(false);
    page();

    expect(await heading("This link is not valid any more")).toBeDefined();
    expect(
      screen.getByText(
        "The link may have been used already, or it has expired. Ask for a new one.",
      ),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe(
      "/en/sign-in",
    );
    fireEvent.click(screen.getByRole("button", { name: "Ask for a new link" }));
    expect(push).toHaveBeenCalledWith("/en/forgot-password");
  });

  it.each(["", "   "])(
    "treats an address without a token (%j) as a link not valid",
    async (token) => {
      withToken(token);
      page();

      expect(await heading("This link is not valid any more")).toBeDefined();
      expect(verifyEmail).not.toHaveBeenCalled();
    },
  );

  it("treats an address with no token at all as a link not valid", async () => {
    search = new URLSearchParams();
    page();

    expect(await heading("This link is not valid any more")).toBeDefined();
  });

  it("offers to try again when the API can't be reached, and checks the link again", async () => {
    verifyEmail.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(true);
    page();

    expect(await heading("We couldn't check this link")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await heading("Your email is confirmed")).toBeDefined();
    expect(verifyEmail).toHaveBeenCalledTimes(2);
  });

  it("uses each link once even when the effect runs twice", async () => {
    verifyEmail.mockResolvedValue(true);

    const first = page();
    first.unmount();
    page();

    expect(await heading("Your email is confirmed")).toBeDefined();
    expect(verifyEmail).toHaveBeenCalledOnce();
  });

  it("ignores a failed check that ends after the page has gone", async () => {
    let fail: (error: Error) => void = () => undefined;
    verifyEmail.mockReturnValue(new Promise((_resolve, reject) => (fail = reject)));
    const error = vi.spyOn(console, "error");

    page().unmount();
    await act(async () => fail(new Error("offline")));

    expect(error).not.toHaveBeenCalled();
  });

  it("forgets a failed check, so the link can be tried again", async () => {
    verifyEmail.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(true);
    const token = withToken();

    await expect(checkOnce(token)).rejects.toThrow("offline");
    await waitFor(() => expect(checkOnce(token)).resolves.toBe(true));
  });
});
