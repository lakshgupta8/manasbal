import { DEMO_PASSWORD } from "@manasbal/seed/demo-logins";
import { DEMO_EMAILS } from "@manasbal/types/demo-logins";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as auth from "@/lib/auth";
import { MESSAGES } from "@/test/intl";
import { useAuth } from "./auth-provider";
import { DEFAULT_WAIT_SECONDS } from "./auth-form-parts";
import { SignInForm, type SignInWords } from "./sign-in-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/auth", () => ({ signIn: vi.fn() }));
vi.mock("./auth-provider", () => ({ useAuth: vi.fn() }));

const signIn = vi.mocked(auth.signIn);
const signedIn = vi.fn(async () => undefined);

// The words the page passes, straight from the English messages.
const WORDS: SignInWords = MESSAGES.en.SignIn;
const SESSION = { accessToken: "token", expiresIn: 900 };

function form() {
  return render(
    <SignInForm
      words={WORDS}
      homeHref="/en"
      forgotPasswordHref="/en/forgot-password"
      createAccountHref="/en/sign-up"
    />,
  );
}

const email = () => screen.getByRole("textbox", { name: "Email" }) as HTMLInputElement;
const password = () => screen.getByLabelText("Password (required)") as HTMLInputElement;
const submit = () => screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement;
const description = (input: HTMLElement) =>
  document.getElementById(input.getAttribute("aria-describedby") ?? "")?.textContent;

function fillAndSubmit(address: string, secret: string) {
  fireEvent.change(email(), { target: { value: address } });
  fireEvent.change(password(), { target: { value: secret } });
  fireEvent.click(submit());
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    state: { status: "signedOut" },
    signedIn,
    signOut: vi.fn(),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("SignInForm", () => {
  it.each(Object.entries(DEMO_EMAILS))(
    "signs in as the demo %s with one click, then goes home",
    async (role, address) => {
      signIn.mockResolvedValue({ kind: "signedIn", session: SESSION });
      form();

      fireEvent.click(
        screen.getByRole("button", { name: WORDS.roles[role as keyof typeof DEMO_EMAILS] }),
      );

      await waitFor(() => expect(push).toHaveBeenCalledWith("/en"));
      expect(signIn).toHaveBeenCalledWith(address, DEMO_PASSWORD);
      expect(signedIn).toHaveBeenCalledWith(SESSION);
    },
  );

  it("lists the five demo logins under their heading, in order", () => {
    form();

    const group = screen.getByRole("region", { name: "Try it with a demo login" });
    expect([...group.querySelectorAll("button")].map((button) => button.textContent)).toEqual([
      "Customer",
      "Seller",
      "Seller staff",
      "Support",
      "Admin",
    ]);
  });

  it("signs in with the email and password typed, trimming the email", async () => {
    signIn.mockResolvedValue({ kind: "signedIn", session: SESSION });
    form();

    fillAndSubmit("  buyer@example.test ", "a long passphrase");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/en"));
    expect(signIn).toHaveBeenCalledWith("buyer@example.test", "a long passphrase");
  });

  it("says what is missing next to each field before sending anything", () => {
    form();

    fireEvent.click(submit());

    expect(email().getAttribute("aria-invalid")).toBe("true");
    expect(description(email())).toBe("Enter your email");
    expect(description(password())).toBe("Enter your password");
    expect(document.activeElement).toBe(email());
    expect(signIn).not.toHaveBeenCalled();
  });

  it("asks for a real email address, and moves to the password when only it is missing", () => {
    form();

    fillAndSubmit("not-an-email", "");
    expect(description(email())).toBe("Enter an email like name@example.test");

    fillAndSubmit("buyer@example.test", "");
    expect(email().hasAttribute("aria-invalid")).toBe(false);
    expect(document.activeElement).toBe(password());
  });

  it("says the email and password do not match, next to the password", async () => {
    signIn.mockResolvedValue({ kind: "wrongPassword" });
    form();

    fillAndSubmit("buyer@example.test", "wrong one");

    await waitFor(() => expect(password().getAttribute("aria-invalid")).toBe("true"));
    expect(description(password())).toBe(
      "That email and password do not match. Check them and try again.",
    );
    expect(document.activeElement).toBe(password());
    expect(push).not.toHaveBeenCalled();
  });

  it.each([
    ["notConfirmed", "Confirm your email first: open the link we sent you."],
    ["invalid", "Enter an email like name@example.test"],
  ] as const)("explains %s next to the email", async (kind, words) => {
    signIn.mockResolvedValue({ kind });
    form();

    fillAndSubmit("buyer@example.test", "a long passphrase");

    await waitFor(() => expect(description(email())).toBe(words));
  });

  it("after too many tries, says how long to wait and keeps the button waiting that long", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    signIn.mockResolvedValue({ kind: "tooManyTries", retryAfterSeconds: 900 });
    form();

    fillAndSubmit("buyer@example.test", "a long passphrase");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Too many tries. Wait 15 minutes and try again.",
    );
    expect(submit().disabled).toBe(true);
    // The demo logins are never locked out.
    expect((screen.getByRole("button", { name: "Customer" }) as HTMLButtonElement).disabled).toBe(
      false,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900 * 1000);
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(submit().disabled).toBe(false);
  });

  it("waits a minute when the API doesn't say how long", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    signIn.mockResolvedValue({ kind: "tooManyTries" });
    form();

    fillAndSubmit("buyer@example.test", "a long passphrase");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Too many tries. Wait a little and try again.",
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_WAIT_SECONDS * 1000);
    });
    expect(submit().disabled).toBe(false);
  });

  it.each([
    [{ kind: "twoStep", challengeToken: "c" } as const, WORDS.twoStep],
    [undefined, WORDS.unavailable],
  ])("shows an alert under the title when it can't sign in here", async (outcome, words) => {
    if (outcome) signIn.mockResolvedValue(outcome);
    else signIn.mockRejectedValue(new Error("offline"));
    form();

    fillAndSubmit("buyer@example.test", "a long passphrase");

    expect((await screen.findByRole("alert")).textContent).toBe(words);
  });

  it("can't be sent twice while it is signing in", async () => {
    let finish: (outcome: auth.SignInOutcome) => void = () => undefined;
    signIn.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    form();

    fillAndSubmit("buyer@example.test", "a long passphrase");

    expect(submit().disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Admin" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await act(async () => finish({ kind: "wrongPassword" }));
    expect(submit().disabled).toBe(false);
  });

  it("links to the forgotten-password and new-account pages", () => {
    form();

    expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe(
      "/en/forgot-password",
    );
    expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href")).toBe(
      "/en/sign-up",
    );
  });
});
