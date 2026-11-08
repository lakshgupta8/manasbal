import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MESSAGES } from "@/test/intl";
import { AuthCard, CardLink, FormAlert, looksLikeEmail, tooManyTriesText } from "./auth-form-parts";

const WORDS = MESSAGES.en.SignIn;

describe("tooManyTriesText", () => {
  it.each([
    [undefined, "Too many tries. Wait a little and try again."],
    [0, "Too many tries. Wait 1 minute and try again."],
    [60, "Too many tries. Wait 1 minute and try again."],
    [61, "Too many tries. Wait 2 minutes and try again."],
    [900, "Too many tries. Wait 15 minutes and try again."],
  ])("for %s seconds says %s", (seconds, text) => {
    expect(tooManyTriesText(WORDS, seconds)).toBe(text);
  });
});

describe("looksLikeEmail", () => {
  it.each(["name@example.test", "a.b@sub.example.co.in"])("takes %s", (email) => {
    expect(looksLikeEmail(email)).toBe(true);
  });

  it.each([
    "",
    "name",
    "@example.test",
    "name@",
    "name@example",
    "name@.test",
    "name@example.",
    "a@b@example.test",
    "name @example.test",
  ])("refuses %j", (email) => {
    expect(looksLikeEmail(email)).toBe(false);
  });

  it("stays fast on a long input with no @", () => {
    const start = performance.now();
    looksLikeEmail("a".repeat(100_000));
    expect(performance.now() - start).toBeLessThan(100);
  });
});

describe("FormAlert", () => {
  it("is an alert with an icon hidden from assistive tech and the words", () => {
    render(<FormAlert>Too many tries.</FormAlert>);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Too many tries.");
    expect(alert.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("AuthCard and CardLink", () => {
  it("draws the card around its content, with links", () => {
    render(
      <AuthCard>
        <h1>Sign in</h1>
        <CardLink href="/en/sign-up">Create an account</CardLink>
      </AuthCard>,
    );

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href")).toBe(
      "/en/sign-up",
    );
  });
});
