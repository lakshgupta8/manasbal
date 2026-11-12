import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { VerifyEmailProps } from "@/components/verify-email";
import { MESSAGES, type TestLocale } from "@/test/intl";
import VerifyEmailPage, { generateMetadata } from "./page";

vi.mock("next-intl/server", () => import("@/test/intl"));
// The check has its own tests; here it shows what the page passes it.
const passed: VerifyEmailProps[] = [];
vi.mock("@/components/auth-forms", () => ({
  VerifyEmail: (props: VerifyEmailProps) => {
    passed.push(props);
    return <h1>{props.words.confirmedTitle}</h1>;
  },
}));

const args = (locale: TestLocale) =>
  ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }) as never;

describe("VerifyEmailPage", () => {
  it.each(["en", "hi"] as const)("titles the %s page in its language", async (locale) => {
    await expect(generateMetadata(args(locale))).resolves.toEqual({
      title: MESSAGES[locale].VerifyEmail.pageTitle,
    });
  });

  it.each(["en", "hi"] as const)("passes the check every %s word and link", async (locale) => {
    passed.length = 0;
    render(await VerifyEmailPage(args(locale)));

    const words = MESSAGES[locale].VerifyEmail;
    expect(passed[0]!.words).toEqual(words);
    expect(passed[0]!.signInHref).toBe(`/${locale}/sign-in`);
    expect(passed[0]!.newLinkHref).toBe(`/${locale}/forgot-password`);
    expect(screen.getByRole("heading", { level: 1, name: words.confirmedTitle })).toBeDefined();
  });
});
