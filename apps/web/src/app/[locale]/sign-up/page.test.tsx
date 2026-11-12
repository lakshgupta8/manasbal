import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SignUpFormProps } from "@/components/sign-up-form";
import { MESSAGES, type TestLocale } from "@/test/intl";
import SignUpPage, { generateMetadata } from "./page";

vi.mock("next-intl/server", () => import("@/test/intl"));
// The form has its own tests; here it shows what the page passes it.
const passed: SignUpFormProps[] = [];
vi.mock("@/components/auth-forms", () => ({
  SignUpForm: (props: SignUpFormProps) => {
    passed.push(props);
    return <h1>{props.words.title}</h1>;
  },
}));

const args = (locale: TestLocale) =>
  ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }) as never;

describe("SignUpPage", () => {
  it.each(["en", "hi"] as const)("titles the %s page in its language", async (locale) => {
    await expect(generateMetadata(args(locale))).resolves.toEqual({
      title: MESSAGES[locale].SignUp.pageTitle,
    });
  });

  it.each(["en", "hi"] as const)(
    "passes the form every %s word, keeping the placeholders for the browser",
    async (locale) => {
      passed.length = 0;
      render(await SignUpPage(args(locale)));

      const words = MESSAGES[locale].SignUp;
      expect(passed[0]!.words).toEqual(words);
      expect(passed[0]!.words.checkEmailBody).toContain("{email}");
      expect(passed[0]!.signInHref).toBe(`/${locale}/sign-in`);
      expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeDefined();
    },
  );
});
