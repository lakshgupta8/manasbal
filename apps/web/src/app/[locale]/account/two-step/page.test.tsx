import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TwoStepSettingsProps } from "@/components/account-security";
import { MESSAGES } from "@/test/intl";
import TwoStepPage, { generateMetadata } from "./page";

vi.mock("next-intl/server", () => import("@/test/intl"));
const connection = vi.fn(async () => undefined);
vi.mock("next/server", () => ({ connection: () => connection() }));
// The settings have their own tests; here they show each state the page draws for them.
const passed: TwoStepSettingsProps[] = [];
vi.mock("@/components/auth-forms", () => ({
  TwoStepSettings: (props: TwoStepSettingsProps) => {
    passed.push(props);
    return (
      <>
        <div data-testid="loading">{props.states.loading}</div>
        <div data-testid="demo">{props.states.demo}</div>
      </>
    );
  },
}));

const args = (locale: "en" | "hi") => ({ params: Promise.resolve({ locale }) }) as never;

describe("TwoStepPage", () => {
  it.each(["en", "hi"] as const)(
    "titles the %s page and keeps it out of search",
    async (locale) => {
      await expect(generateMetadata(args(locale))).resolves.toEqual({
        title: MESSAGES[locale].Account.twoStepPageTitle,
        robots: { index: false },
      });
    },
  );

  it("renders on each request, under breadcrumbs back to the account", async () => {
    passed.length = 0;
    render(await TwoStepPage(args("en")));

    expect(connection).toHaveBeenCalled();
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumbs" });
    expect([...crumbs.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toEqual([
      "/en",
      "/en/account",
    ]);
    expect(crumbs.querySelector("[aria-current=page]")!.textContent).toBe("Two-step sign-in");
    expect(passed[0]!.signInHref).toBe("/en/sign-in?next=%2Fen%2Faccount%2Ftwo-step");
  });

  it("draws the loading state and the demo login message on the server", async () => {
    render(await TwoStepPage(args("en")));

    expect(screen.getByTestId("loading").textContent).toBe("Loading two-step sign-in");
    expect(screen.getByTestId("demo").textContent).toContain(
      "Two-step sign-in is off for demo logins.",
    );
  });
});
