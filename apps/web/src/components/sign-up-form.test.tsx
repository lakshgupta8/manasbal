import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as auth from "@/lib/auth";
import { MESSAGES } from "@/test/intl";
import { DEFAULT_WAIT_SECONDS } from "./auth-form-parts";
import { SignUpForm, type SignUpWords } from "./sign-up-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/auth", () => ({ signUp: vi.fn() }));

const signUp = vi.mocked(auth.signUp);
const WORDS: SignUpWords = MESSAGES.en.SignUp;
const DETAILS = { name: "Asha Rao", email: "asha@example.test", password: "a long passphrase" };

function form() {
  return render(<SignUpForm words={WORDS} signInHref="/en/sign-in" />);
}

const field = (name: string) => screen.getByRole("textbox", { name }) as HTMLInputElement;
const password = () => screen.getByLabelText("Password (required)") as HTMLInputElement;
const adult = () => screen.getByRole("checkbox", { name: "I am 18 or older" }) as HTMLInputElement;
const submit = () => screen.getByRole("button", { name: "Create account" }) as HTMLButtonElement;
const description = (input: HTMLElement) =>
  document.getElementById(input.getAttribute("aria-describedby") ?? "")?.textContent;

function fill({
  name = DETAILS.name,
  email = DETAILS.email,
  secret = DETAILS.password,
  tick = true,
} = {}) {
  fireEvent.change(field("Name"), { target: { value: name } });
  fireEvent.change(field("Email"), { target: { value: email } });
  fireEvent.change(password(), { target: { value: secret } });
  if (tick) fireEvent.click(adult());
  fireEvent.click(submit());
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("SignUpForm", () => {
  it("shows the fields, the unticked 18+ box, the demo note and the way to sign in", () => {
    form();

    expect(screen.getByRole("heading", { level: 1, name: "Create your account" })).toBeDefined();
    expect(description(field("Name"))).toBe("Use a made-up name");
    expect(description(field("Email"))).toBe("We use it only to sign you in");
    expect(description(password())).toBe("At least 12 characters");
    expect(adult().checked).toBe(false);
    expect(
      screen.getByText("This is a demo: use made-up details. Your account is deleted every night."),
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Already have an account? Sign in" }).getAttribute("href"),
    ).toBe("/en/sign-in");
  });

  it("says what is missing next to each field, the box included, before sending anything", () => {
    form();

    fireEvent.click(submit());

    expect(description(field("Name"))).toBe("Enter a name");
    expect(description(field("Email"))).toBe("Enter your email");
    expect(description(password())).toBe("Use at least 12 characters");
    expect(description(adult())).toBe("Tick the box to continue");
    expect(adult().getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(field("Name"));
    expect(signUp).not.toHaveBeenCalled();
  });

  it("asks for a real email and a long enough password, and moves to the first problem", () => {
    form();

    fill({ email: "asha", secret: "short", tick: false });

    expect(field("Name").hasAttribute("aria-invalid")).toBe(false);
    expect(description(field("Email"))).toBe("Enter an email like name@example.test");
    expect(document.activeElement).toBe(field("Email"));
  });

  it("goes to sign-in when the account can sign in at once (mail is off)", async () => {
    signUp.mockResolvedValue({ kind: "created", emailConfirmed: true });
    form();

    fill({ name: "  Asha Rao ", email: " asha@example.test " });

    await waitFor(() => expect(push).toHaveBeenCalledWith("/en/sign-in"));
    expect(signUp).toHaveBeenCalledWith(DETAILS);
  });

  it("says to check the email when a link was mailed, and moves to that heading", async () => {
    signUp.mockResolvedValue({ kind: "created", emailConfirmed: false });
    form();

    fill();

    const heading = await screen.findByRole("heading", { level: 1, name: "Check your email" });
    expect(document.activeElement).toBe(heading);
    expect(
      screen.getByText(
        "We sent a link to asha@example.test. Open it to confirm your account, then sign in.",
      ),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe(
      "/en/sign-in",
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: "refused" } as const, WORDS.refused],
    [undefined, WORDS.unavailable],
  ])("shows an alert under the title when the account can't be created", async (outcome, words) => {
    if (outcome) signUp.mockResolvedValue(outcome);
    else signUp.mockRejectedValue(new Error("offline"));
    form();

    fill();

    expect((await screen.findByRole("alert")).textContent).toBe(words);
    expect(submit().disabled).toBe(false);
  });

  it("after too many tries, says how long to wait and keeps the button waiting", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    signUp.mockResolvedValue({ kind: "tooManyTries", retryAfterSeconds: 120 });
    form();

    fill();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Too many tries. Wait 2 minutes and try again.",
    );
    expect(submit().disabled).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120 * 1000);
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(submit().disabled).toBe(false);
  });

  it("waits a minute when the API doesn't say how long", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    signUp.mockResolvedValue({ kind: "tooManyTries" });
    form();

    fill();

    expect((await screen.findByRole("alert")).textContent).toBe(WORDS.tooManyTries);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_WAIT_SECONDS * 1000);
    });
    expect(submit().disabled).toBe(false);
  });

  it("can't be sent twice while the account is being created", async () => {
    let finish: (outcome: auth.SignUpOutcome) => void = () => undefined;
    signUp.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    form();

    fill();

    expect(submit().disabled).toBe(true);
    await act(async () => finish({ kind: "refused" }));
    expect(submit().disabled).toBe(false);
  });
});
