import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SessionListProps } from "@/components/account-security";
import { MESSAGES } from "@/test/intl";
import SessionsPage, { generateMetadata } from "./page";

vi.mock("next-intl/server", () => import("@/test/intl"));
const connection = vi.fn(async () => undefined);
vi.mock("next/server", () => ({ connection: () => connection() }));
// The list has its own tests; here it shows each state the page draws for it.
const passed: SessionListProps[] = [];
vi.mock("@/components/auth-forms", () => ({
  SessionList: (props: SessionListProps) => {
    passed.push(props);
    const { loading, listLoading, loadFailed } = props.states;
    return (
      <>
        <div data-testid="loading">{loading}</div>
        <div data-testid="listLoading">{listLoading}</div>
        <div data-testid="loadFailed">{loadFailed}</div>
      </>
    );
  },
}));

const args = (locale: "en" | "hi") => ({ params: Promise.resolve({ locale }) }) as never;

describe("SessionsPage", () => {
  it.each(["en", "hi"] as const)(
    "titles the %s page and keeps it out of search",
    async (locale) => {
      await expect(generateMetadata(args(locale))).resolves.toEqual({
        title: MESSAGES[locale].Account.sessionsPageTitle,
        robots: { index: false },
      });
    },
  );

  it("renders on each request, under breadcrumbs back to the account", async () => {
    passed.length = 0;
    render(await SessionsPage(args("hi")));

    expect(connection).toHaveBeenCalled();
    const crumbs = screen.getByRole("navigation", { name: MESSAGES.hi.Account.breadcrumbs });
    expect([...crumbs.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toEqual([
      "/hi",
      "/hi/account",
    ]);
    expect(crumbs.querySelector("[aria-current=page]")!.textContent).toBe(
      MESSAGES.hi.Account.sessionsTitle,
    );
    expect(passed[0]!.locale).toBe("hi");
    expect(passed[0]!.signInHref).toBe("/hi/sign-in?next=%2Fhi%2Faccount%2Fsessions");
  });

  it("draws the loading and error states on the server", async () => {
    render(await SessionsPage(args("en")));

    expect(screen.getByTestId("loading").textContent).toBe("Loading your sessions");
    expect(screen.getByTestId("listLoading").querySelector("h2")!.textContent).toBe(
      "Loading your sessions",
    );
    expect(screen.getByTestId("loadFailed").textContent).toContain(
      "We couldn't load your sessions.",
    );
    expect(screen.getByRole("link", { name: "Try again" }).getAttribute("href")).toBe(
      "/en/account/sessions",
    );
  });
});
