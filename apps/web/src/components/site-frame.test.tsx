import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MESSAGES, type TestLocale, withIntl } from "@/test/intl";
import type { AccountMenuProps } from "./account-menu";
import { MAIN_ID, REPO_URL, SiteFrame } from "./site-frame";

vi.mock("next-intl/server", () => import("@/test/intl"));
vi.mock("next/navigation", () => ({ usePathname: () => "/en" }));
// The menu has its own tests; here it shows what the frame passes it.
vi.mock("./account-menu", () => ({
  AccountMenu: (props: AccountMenuProps) => (
    <a
      href={props.signInHref}
      data-sign-out={props.signOutLabel}
      data-signed-in-as={props.signedInAs}
    >
      {props.signInLabel}
    </a>
  ),
}));

// The switch has its own tests; here it shows where the frame puts it.
vi.mock("./currency-control", () => ({
  CurrencyControl: ({ locale }: { locale: string }) => (
    <span>{`currency switch in ${locale}`}</span>
  ),
}));

// What Tab reaches, in order: nothing in the frame sets a positive tabindex.
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

async function frame(locale: TestLocale) {
  return render(withIntl(await SiteFrame({ locale, children: <h1>The page</h1> }), locale));
}

describe("SiteFrame", () => {
  it("puts the currency switch in the header, before the language switch", async () => {
    const { container } = await frame("hi");

    const actions = container.querySelector(".mb-header__actions")!;
    expect(actions.firstElementChild!.textContent).toBe("currency switch in hi");
  });

  it("puts the skip link first, then the banner, header, page and footer", async () => {
    const { container } = await frame("en");

    expect([...container.children].map((element) => element.tagName)).toEqual([
      "A",
      "ASIDE",
      "HEADER",
      "MAIN",
      "FOOTER",
    ]);
    expect(screen.getByRole("complementary", { name: "Demo notice" })).toBeDefined();
    expect(screen.getByRole("banner")).toBeDefined();
    expect(screen.getByRole("main").textContent).toBe("The page");
    expect(screen.getByRole("contentinfo")).toBeDefined();
  });

  it("reaches the skip link first with Tab, and it leads to the page", async () => {
    const { container } = await frame("en");

    const skip = screen.getByRole("link", { name: "Skip to main content" });
    expect(container.querySelector(FOCUSABLE)).toBe(skip);
    expect(
      container.querySelector('[tabindex]:not([tabindex="-1"]):not([tabindex="0"])'),
    ).toBeNull();
    expect(skip.getAttribute("href")).toBe(`#${MAIN_ID}`);
    expect(screen.getByRole("main").id).toBe(MAIN_ID);
  });

  it("links the home page in the page's language, and the switch to the other one", async () => {
    await frame("en");

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(
      [...nav.querySelectorAll("a")].map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Home", "/en"],
      ["Categories", "/en#categories"],
    ]);
    expect(screen.getByRole("link", { name: "Read in हिन्दी" })).toBeDefined();
  });

  it.each(["en", "hi"] as const)("puts the account menu in the header, in %s", async (locale) => {
    await frame(locale);

    const { Frame } = MESSAGES[locale];
    const account = screen.getByRole("link", { name: Frame.signIn });
    expect(screen.getByRole("banner").contains(account)).toBe(true);
    expect(account.getAttribute("href")).toBe(`/${locale}/sign-in`);
    expect(account.dataset.signOut).toBe(Frame.signOut);
    // The name is filled in the browser, once it is known.
    expect(account.dataset.signedInAs).toBe(Frame.signedInAs);
    expect(Frame.signedInAs).toContain("{name}");
  });

  it("links the source code from the footer, with no draft note in English", async () => {
    await frame("en");

    expect(screen.getByRole("link", { name: "Source code on GitHub" }).getAttribute("href")).toBe(
      REPO_URL,
    );
    expect(screen.getByRole("contentinfo").textContent).not.toContain("Draft");
  });

  it("shows everything in Hindi on a Hindi page, with no draft note now it has been read", async () => {
    await frame("hi");

    const { Frame } = MESSAGES.hi;
    expect(screen.getByRole("link", { name: Frame.skipLink })).toBeDefined();
    expect(screen.getByRole("complementary", { name: Frame.demoLabel }).textContent).toContain(
      Frame.demoHeading,
    );
    expect(screen.getByRole("navigation", { name: Frame.mainNav })).toBeDefined();
    expect(screen.getByRole("link", { name: Frame.home }).getAttribute("href")).toBe("/hi");
    expect(screen.getByRole("navigation", { name: Frame.footerNav })).toBeDefined();
    expect(screen.getByRole("contentinfo").textContent).toContain(Frame.smallPrint);
    expect(screen.getByRole("contentinfo").textContent).not.toContain("Draft");
  });

  // A language whose translation is still a draft says so after the small print.
  it("adds a draft note to the small print when a language has one", async () => {
    const { Frame } = MESSAGES.hi;
    Frame.draftNote = "Draft Hindi.";
    try {
      await frame("hi");

      expect(screen.getByRole("contentinfo").textContent).toContain(
        `${Frame.smallPrint} Draft Hindi.`,
      );
    } finally {
      Frame.draftNote = "";
    }
  });
});
