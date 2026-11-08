import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as auth from "@/lib/auth";
import { MESSAGES } from "@/test/intl";
import { ResetPasswordForm, type ResetPasswordWords } from "./reset-password-form";

const push = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => search,
}));
vi.mock("@/lib/auth", () => ({ resetPassword: vi.fn() }));

const resetPassword = vi.mocked(auth.resetPassword);
const WORDS: ResetPasswordWords = MESSAGES.en.ResetPassword;

function form() {
  return render(
    <ResetPasswordForm words={WORDS} signInHref="/en/sign-in" newLinkHref="/en/forgot-password" />,
  );
}

const password = () => screen.getByLabelText("New password (required)") as HTMLInputElement;
const submit = () => screen.getByRole("button", { name: "Save new password" }) as HTMLButtonElement;
const description = (input: HTMLElement) =>
  document.getElementById(input.getAttribute("aria-describedby") ?? "")?.textContent;

function save(value: string) {
  fireEvent.change(password(), { target: { value } });
  fireEvent.click(submit());
}

async function expectLinkNotValid() {
  expect(
    await screen.findByRole("heading", { level: 1, name: "This link is not valid any more" }),
  ).toBeDefined();
  expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe(
    "/en/sign-in",
  );
  fireEvent.click(screen.getByRole("button", { name: "Ask for a new link" }));
  expect(push).toHaveBeenCalledWith("/en/forgot-password");
}

beforeEach(() => {
  search = new URLSearchParams({ token: "link-token" });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("ResetPasswordForm", () => {
  it("asks for a new password under the sign-up rule", () => {
    form();

    expect(screen.getByRole("heading", { level: 1, name: "Choose a new password" })).toBeDefined();
    expect(description(password())).toBe("At least 12 characters");
    expect(password().getAttribute("autocomplete")).toBe("new-password");
  });

  it("saves it with the token, then says to sign in with it", async () => {
    resetPassword.mockResolvedValue({ kind: "changed" });
    form();

    save("a new passphrase");

    expect((await screen.findByRole("status")).textContent).toBe("Sign in with your new password.");
    expect(resetPassword).toHaveBeenCalledWith("link-token", "a new passphrase");
    expect(
      screen.getByRole("heading", { level: 1, name: "Your password is changed" }),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/en/sign-in");
  });

  it.each([
    ["short", "Use at least 12 characters"],
    ["x".repeat(129), "Use 128 characters or fewer"],
  ])("refuses %j next to the field, before sending", (value, words) => {
    form();

    save(value);

    expect(description(password())).toBe(words);
    expect(document.activeElement).toBe(password());
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("says the link is not valid any more when the API refuses the token", async () => {
    resetPassword.mockResolvedValue({ kind: "linkInvalid" });
    form();

    save("a new passphrase");

    await expectLinkNotValid();
  });

  it.each([new URLSearchParams(), new URLSearchParams({ token: "  " })])(
    "says the link is not valid any more without a token",
    async (params) => {
      search = params;
      form();

      await expectLinkNotValid();
      expect(resetPassword).not.toHaveBeenCalled();
    },
  );

  it("after too many tries, says how long to wait", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resetPassword.mockResolvedValue({ kind: "tooManyTries" });
    form();

    save("a new passphrase");

    expect((await screen.findByRole("alert")).textContent).toBe(WORDS.tooManyTries);
    expect(submit().disabled).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 1000);
    });
    expect(submit().disabled).toBe(false);
  });

  it("shows an alert when the API can't be reached", async () => {
    resetPassword.mockRejectedValue(new Error("offline"));
    form();

    save("a new passphrase");

    expect((await screen.findByRole("alert")).textContent).toBe(WORDS.unavailable);
  });
});
