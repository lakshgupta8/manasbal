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
    return <h1>{props.words.title}</h1>;
  },
}));

const args = (locale: TestLocale, search: Record<string, string> = {}) =>
  ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(search) }) as never;

describe("SignInPage", () => {
  it.each(["en", "hi"] as const)("titles the %s page in its language", async (locale) => {
    await expect(generateMetadata(args(locale))).resolves.toEqual({
      title: MESSAGES[locale].SignIn.pageTitle,
    });
  });

  it.each(["en", "hi"] as const)(
    "passes the form its %s words, the second step's and the links",
    async (locale) => {
      passed.length = 0;
      render(await SignInPage(args(locale)));

      const [props] = passed;
      expect(props!.words).toEqual(MESSAGES[locale].SignIn);
      expect(props!.twoStepWords).toEqual(MESSAGES[locale].TwoStep);
      // The browser fills the wait in.
      expect(props!.words.tooManyTriesMinutes).toContain("{minutes}");
      expect(props!.homeHref).toBe(`/${locale}`);
      expect(props!.forgotPasswordHref).toBe(`/${locale}/forgot-password`);
      expect(props!.createAccountHref).toBe(`/${locale}/sign-up`);
      expect(
        screen.getByRole("heading", { level: 1, name: MESSAGES[locale].SignIn.title }),
      ).toBeDefined();
    },
  );

  it("sends the visitor back to the page that asked them to sign in", async () => {
    passed.length = 0;
    render(await SignInPage(args("en", { next: "/en/account/addresses" })));

    expect(passed[0]!.homeHref).toBe("/en/account/addresses");
  });

  it("goes home instead of to another site", async () => {
    passed.length = 0;
    render(await SignInPage(args("en", { next: "https://evil.example/en" })));

    expect(passed[0]!.homeHref).toBe("/en");
  });
});
