import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as auth from "@/lib/auth";
import { MESSAGES } from "@/test/intl";
import { ForgotPasswordForm, type ForgotPasswordWords } from "./forgot-password-form";

vi.mock("@/lib/auth", () => ({ forgotPassword: vi.fn() }));

const forgotPassword = vi.mocked(auth.forgotPassword);
const WORDS: ForgotPasswordWords = MESSAGES.en.ForgotPassword;
const SENT = "If this email has an account, a link is on its way.";

function form() {
  return render(<ForgotPasswordForm words={WORDS} signInHref="/en/sign-in" />);
}

const email = () => screen.getByRole("textbox", { name: "Email" }) as HTMLInputElement;
const submit = () => screen.getByRole("button", { name: "Send the link" }) as HTMLButtonElement;
const description = (input: HTMLElement) =>
  document.getElementById(input.getAttribute("aria-describedby") ?? "")?.textContent;

function send(address: string) {
  fireEvent.change(email(), { target: { value: address } });
  fireEvent.click(submit());
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("ForgotPasswordForm", () => {
  it("asks for the email, with a way back to sign-in", () => {
    form();

    expect(screen.getByRole("heading", { level: 1, name: "Forgot your password?" })).toBeDefined();
    expect(
      screen.getByText("Enter your email and we will send you a link to reset it."),
    ).toBeDefined();
    expect(description(email())).toBe("We will only use it to send this link.");
    expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe(
      "/en/sign-in",
    );
  });

  it("always says the same thing once sent, in the same card", async () => {
    forgotPassword.mockResolvedValue({ kind: "sent" });
    form();

    send(" someone@example.test ");

    expect((await screen.findByRole("status")).textContent).toBe(SENT);
    expect(forgotPassword).toHaveBeenCalledWith("someone@example.test");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Forgot your password?" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toBeDefined();
  });

  it.each([
    ["", "Enter your email"],
    ["someone", "Enter an email like name@example.test"],
  ])("says what is wrong with %j next to the field", (address, words) => {
    form();

    send(address);

    expect(description(email())).toBe(words);
    expect(document.activeElement).toBe(email());
    expect(forgotPassword).not.toHaveBeenCalled();
  });

  it("after too many tries, says how long to wait", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    forgotPassword.mockResolvedValue({ kind: "tooManyTries", retryAfterSeconds: 60 });
    form();

    send("someone@example.test");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Too many tries. Wait 1 minute and try again.",
    );
    expect(submit().disabled).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 1000);
    });
    expect(submit().disabled).toBe(false);
  });

  it("shows an alert, not the sent message, when the API can't be reached", async () => {
    forgotPassword.mockRejectedValue(new Error("offline"));
    form();

    send("someone@example.test");

    expect((await screen.findByRole("alert")).textContent).toBe(WORDS.unavailable);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
