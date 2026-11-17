import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AddressBookProps } from "@/components/account-pages";
import { MESSAGES } from "@/test/intl";
import AddressesPage, { generateMetadata } from "./page";

vi.mock("next-intl/server", () => import("@/test/intl"));
const connection = vi.fn(async () => undefined);
vi.mock("next/server", () => ({ connection: () => connection() }));
// The address book has its own tests; here it shows each state the page draws for it.
const passed: AddressBookProps[] = [];
vi.mock("@/components/auth-forms", () => ({
  AddressBook: (props: AddressBookProps) => {
    passed.push(props);
    const { loading, listLoading, loadFailed, notice } = props.states;
    return (
      <>
        <div data-testid="loading">{loading}</div>
        <div data-testid="listLoading">{listLoading}</div>
        <div data-testid="loadFailed">{loadFailed}</div>
        <div data-testid="notice">{notice}</div>
      </>
    );
  },
}));

const args = (locale: "en" | "hi") => ({ params: Promise.resolve({ locale }) }) as never;

describe("AddressesPage", () => {
  it.each(["en", "hi"] as const)(
    "titles the %s page and keeps it out of search",
    async (locale) => {
      await expect(generateMetadata(args(locale))).resolves.toEqual({
        title: MESSAGES[locale].Account.addressesPageTitle,
        robots: { index: false },
      });
    },
  );

  it("renders on each request, under breadcrumbs back to the account", async () => {
    passed.length = 0;
    render(await AddressesPage(args("en")));

    expect(connection).toHaveBeenCalled();
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumbs" });
    expect(
      [...crumbs.querySelectorAll("a")].map((link) => [
        link.textContent,
        link.getAttribute("href"),
      ]),
    ).toEqual([
      ["Home", "/en"],
      ["Your account", "/en/account"],
    ]);
    expect(crumbs.querySelector("[aria-current=page]")!.textContent).toBe("Your addresses");
    expect(passed[0]!.signInHref).toBe("/en/sign-in?next=%2Fen%2Faccount%2Faddresses");
  });

  it("draws the loading, error and notice states on the server", async () => {
    render(await AddressesPage(args("en")));

    expect(screen.getByTestId("loading").textContent).toBe("Loading your addresses");
    expect(screen.getByTestId("listLoading").querySelector("h2")!.textContent).toBe(
      "Loading your addresses",
    );
    const failed = screen.getByTestId("loadFailed");
    expect(failed.textContent).toContain("We couldn't load your addresses.");
    expect(screen.getByRole("link", { name: "Try again" }).getAttribute("href")).toBe(
      "/en/account/addresses",
    );
    expect(screen.getByTestId("notice").textContent).toContain(MESSAGES.en.Account.madeUp);
  });
});
