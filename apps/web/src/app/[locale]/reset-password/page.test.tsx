import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ResetPasswordFormProps } from "@/components/reset-password-form";
import { MESSAGES, type TestLocale } from "@/test/intl";
import ResetPasswordPage, { generateMetadata } from "./page";

vi.mock("next-intl/server", () => import("@/test/intl"));
// The form has its own tests; here it shows what the page passes it.
const passed: ResetPasswordFormProps[] = [];
vi.mock("@/components/auth-forms", () => ({
  ResetPasswordForm: (props: ResetPasswordFormProps) => {
    passed.push(props);
    return <h1>{props.words.title}</h1>;
  },
}));

const args = (locale: TestLocale) =>
  ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }) as never;

describe("ResetPasswordPage", () => {
  it.each(["en", "hi"] as const)("titles the %s page in its language", async (locale) => {
    await expect(generateMetadata(args(locale))).resolves.toEqual({
      title: MESSAGES[locale].ResetPassword.pageTitle,
    });
  });

  it.each(["en", "hi"] as const)("passes the form its %s words and links", async (locale) => {
    passed.length = 0;
    render(await ResetPasswordPage(args(locale)));

    const words = MESSAGES[locale].ResetPassword;
    expect(passed[0]!.words).toEqual(words);
    expect(passed[0]!.signInHref).toBe(`/${locale}/sign-in`);
    expect(passed[0]!.newLinkHref).toBe(`/${locale}/forgot-password`);
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeDefined();
  });
});
