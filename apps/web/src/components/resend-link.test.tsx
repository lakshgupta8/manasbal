import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as auth from "@/lib/auth";
import { MESSAGES } from "@/test/intl";
import { RESEND_PAUSE_MS, ResendLink } from "./resend-link";

vi.mock("@/lib/auth", () => ({ resendVerification: vi.fn() }));

const resendVerification = vi.mocked(auth.resendVerification);
const WORDS = MESSAGES.en.SignUp;
const SENT = "If this email has an unconfirmed account, a new link is on its way.";

const button = () =>
  screen.getByRole("button", { name: "Send the link again" }) as HTMLButtonElement;

// Clicks and lets the answer arrive.
async function click() {
  await act(async () => {
    fireEvent.click(button());
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("ResendLink", () => {
  it("asks for a new link for the email, then says the same neutral thing", async () => {
    resendVerification.mockResolvedValue({ kind: "sent" });
    render(<ResendLink email="new.buyer@example.test" words={WORDS} />);
    expect(screen.queryByText(SENT)).toBeNull();

    await click();

    expect(resendVerification).toHaveBeenCalledWith("new.buyer@example.test");
    expect(screen.getByText(SENT).tagName).toBe("OUTPUT");
  });

  it("rests for a while after a click, then can be pressed again", async () => {
    vi.useFakeTimers();
    resendVerification.mockResolvedValue({ kind: "sent" });
    render(<ResendLink email="a@example.test" words={WORDS} />);

    await click();
    expect(button().disabled).toBe(true);

    act(() => {
      vi.advanceTimersByTime(RESEND_PAUSE_MS - 1);
    });
    expect(button().disabled).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(button().disabled).toBe(false);
    expect(RESEND_PAUSE_MS).toBe(30_000);
  });

  it("waits as long as Retry-After says after too many tries", async () => {
    vi.useFakeTimers();
    resendVerification.mockResolvedValue({ kind: "tooManyTries", retryAfterSeconds: 120 });
    render(<ResendLink email="a@example.test" words={WORDS} />);

    await click();

    expect(screen.getByRole("alert").textContent).toContain("2 minutes");
    expect(screen.queryByText(SENT)).toBeNull();
    expect(button().disabled).toBe(true);
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(button().disabled).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says when the shop can't be reached", async () => {
    resendVerification.mockRejectedValue(new TypeError("fetch failed"));
    render(<ResendLink email="a@example.test" words={WORDS} />);

    await click();

    expect(screen.getByRole("alert").textContent).toContain(WORDS.unavailable);
    expect(button().disabled).toBe(false);
  });

  it("speaks Hindi on a Hindi page", async () => {
    resendVerification.mockResolvedValue({ kind: "sent" });
    const words = MESSAGES.hi.SignUp;
    render(<ResendLink email="a@example.test" words={words} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: words.resend }));
    });

    expect(screen.getByText(words.resendSent)).toBeDefined();
  });
});
