import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AccountProfileProps } from "@/components/account-pages";
import { MESSAGES } from "@/test/intl";
import AccountPage, { generateMetadata } from "./page";

vi.mock("next-intl/server", () => import("@/test/intl"));
const connection = vi.fn(async () => undefined);
vi.mock("next/server", () => ({ connection: () => connection() }));
// The profile has its own tests; here it shows what the page passes it.
const passed: AccountProfileProps[] = [];
vi.mock("@/components/auth-forms", () => ({
  AccountProfile: (props: AccountProfileProps) => {
    passed.push(props);
    return <>{props.loading}</>;
  },
}));

const args = (locale: "en" | "hi") => ({ params: Promise.resolve({ locale }) }) as never;

describe("AccountPage", () => {
  it.each(["en", "hi"] as const)(
    "titles the %s page and keeps it out of search",
    async (locale) => {
      await expect(generateMetadata(args(locale))).resolves.toEqual({
        title: MESSAGES[locale].Account.pageTitle,
        robots: { index: false },
      });
    },
  );

  it("renders on each request, with the profile's words and links", async () => {
    passed.length = 0;
    render(await AccountPage(args("en")));

    expect(connection).toHaveBeenCalled();
    const [props] = passed;
    expect(props!.words).toEqual(MESSAGES.en.Account);
    expect(props!.signInHref).toBe("/en/sign-in?next=%2Fen%2Faccount");
    expect(props!.addressesHref).toBe("/en/account/addresses");
    expect(screen.getByRole("status").textContent).toBe("Loading your account");
  });
});
