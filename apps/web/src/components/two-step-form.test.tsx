import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as auth from "@/lib/auth";
import { MESSAGES } from "@/test/intl";
import { TwoStepForm, type TwoStepWords } from "./two-step-form";

vi.mock("@/lib/auth", () => ({ verifyTwoStep: vi.fn() }));

const verifyTwoStep = vi.mocked(auth.verifyTwoStep);
const WORDS: TwoStepWords = MESSAGES.en.TwoStep;
const SESSION = { accessToken: "token", expiresIn: 900 };
const onSignedIn = vi.fn(async () => undefined);
const onSignInAgain = vi.fn();

function form() {
  return render(
    <TwoStepForm
      words={WORDS}
      challengeToken="challenge"
      onSignedIn={onSignedIn}
      onSignInAgain={onSignInAgain}
    />,
  );
}

const code = () => screen.getByRole("textbox", { name: "6-digit code" }) as HTMLInputElement;
const recovery = () => screen.getByRole("textbox", { name: "Recovery code" }) as HTMLInputElement;
const submit = () => screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
const description = (input: HTMLElement) =>
  document.getElementById(input.getAttribute("aria-describedby") ?? "")?.textContent;

function send(field: HTMLInputElement, value: string) {
  fireEvent.change(field, { target: { value } });
  fireEvent.click(submit());
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("TwoStepForm", () => {
  it("asks for the 6-digit code, with the field ready to type in", () => {
    form();

    expect(screen.getByRole("heading", { level: 1, name: "Enter your code" })).toBeDefined();
    expect(description(code())).toBe("Open your authenticator app and type the code.");
    expect(code().getAttribute("inputmode")).toBe("numeric");
    expect(code().getAttribute("autocomplete")).toBe("one-time-code");
    expect(document.activeElement).toBe(code());
  });

  it("sends the code without its spaces, with the challenge, and signs in", async () => {
    verifyTwoStep.mockResolvedValue({ kind: "signedIn", session: SESSION });
    form();

    send(code(), " 123 456 ");

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(SESSION));
    expect(verifyTwoStep).toHaveBeenCalledWith("challenge", "123456");
  });

  it("asks for six digits before sending anything", () => {
    form();

    send(code(), "12a45");

    expect(description(code())).toBe("Enter the 6 digits from your authenticator app");
    expect(code().getAttribute("aria-invalid")).toBe("true");
    expect(verifyTwoStep).not.toHaveBeenCalled();
  });

  it("says a wrong code is not right, next to the field, and moves to it", async () => {
    verifyTwoStep.mockResolvedValue({ kind: "wrongCode" });
    form();

    send(code(), "000000");
    fireEvent.click(document.body);

    await waitFor(() =>
      expect(description(code())).toBe(
        "That code is not right. Check the time on your phone and try again.",
      ),
    );
    expect(document.activeElement).toBe(code());
  });

  it("switches to a recovery code and back, each with its own words", async () => {
    verifyTwoStep.mockResolvedValue({ kind: "wrongCode" });
    form();
    send(code(), "12");

    fireEvent.click(screen.getByRole("button", { name: "Use a recovery code instead" }));

    expect(description(recovery())).toBe(
      "One of the codes you saved when you turned on two-step sign-in. Each works once.",
    );
    expect(recovery().value).toBe("");
    expect(recovery().hasAttribute("aria-invalid")).toBe(false);
    expect(recovery().getAttribute("inputmode")).toBe("text");
    expect(document.activeElement).toBe(recovery());

    send(recovery(), "");
    expect(description(recovery())).toBe("Enter a recovery code");

    send(recovery(), "abcde-fghjk");
    await waitFor(() =>
      expect(description(recovery())).toBe(
        "That recovery code is not right, or it was used already.",
      ),
    );
    expect(verifyTwoStep).toHaveBeenCalledWith("challenge", "abcde-fghjk");

    fireEvent.click(screen.getByRole("button", { name: "Use your authenticator app instead" }));
    expect(code()).toBeDefined();
  });

  it("goes back to the password when the challenge can't be used any more", async () => {
    verifyTwoStep.mockResolvedValue({ kind: "signInAgain" });
    form();

    send(code(), "123456");

    await waitFor(() => expect(onSignInAgain).toHaveBeenCalledOnce());
  });

  it("after too many wrong codes, says how long to wait and keeps the button waiting", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    verifyTwoStep.mockResolvedValue({ kind: "tooManyTries", retryAfterSeconds: 900 });
    form();

    send(code(), "123456");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Too many tries. Wait 15 minutes and try again.",
    );
    expect(submit().disabled).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900 * 1000);
    });
    expect(submit().disabled).toBe(false);
  });

  it("shows an alert when the API can't be reached", async () => {
    verifyTwoStep.mockRejectedValue(new Error("offline"));
    form();

    send(code(), "123456");

    expect((await screen.findByRole("alert")).textContent).toBe(WORDS.unavailable);
  });
});
