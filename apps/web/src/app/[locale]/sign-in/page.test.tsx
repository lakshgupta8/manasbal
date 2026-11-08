import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SignInFormProps } from "@/components/sign-in-form";
import { MESSAGES, type TestLocale } from "@/test/intl";
import SignInPage, { generateMetadata } from "./page";

vi.mock("next-intl/server", () => import("@/test/intl"));
// The form has its own tests; here it shows what the page passes it.
const passed: SignInFormProps[] = [];
vi.mock("@/components/auth-forms", () => ({
  SignInForm: (props: SignInFormProps) => {
    passed.push(props);
    return <p>{props.words.submit}</p>;
  },
}));

const args = (locale: TestLocale) =>
  ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }) as never;

describe("SignInPage", () => {
  it.each(["en", "hi"] as const)("titles the %s page in its language", async (locale) => {
    await expect(generateMetadata(args(locale))).resolves.toEqual({
      title: MESSAGES[locale].SignIn.pageTitle,
    });
  });

  it("puts the title above the form and passes it every word and link", async () => {
    passed.length = 0;
    render(await SignInPage(args("en")));

    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeDefined();
    const [props] = passed;
    // Every message but the two the page shows itself.
    const { pageTitle, title, ...words } = MESSAGES.en.SignIn;
    expect([pageTitle, title]).toEqual(["Sign in — Manasbal", "Sign in"]);
    expect(props!.words).toEqual(words);
    expect(props!.homeHref).toBe("/en");
    expect(props!.forgotPasswordHref).toBe("/en/forgot-password");
    expect(props!.createAccountHref).toBe("/en/sign-up");
  });

  it("is in Hindi on a Hindi page, keeping the {minutes} for the browser to fill", async () => {
    passed.length = 0;
    render(await SignInPage(args("hi")));

    const words = MESSAGES.hi.SignIn;
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeDefined();
    expect(passed[0]!.words.roles.seller_staff).toBe(words.roles.seller_staff);
    expect(passed[0]!.words.tooManyTriesMinutes).toBe(words.tooManyTriesMinutes);
    expect(passed[0]!.homeHref).toBe("/hi");
  });
});
