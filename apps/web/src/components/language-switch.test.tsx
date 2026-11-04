import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { withIntl } from "@/test/intl";
import { LanguageLink, LanguageSwitch } from "./language-switch";

const pathname = vi.hoisted(() => ({ current: "/en" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

describe("LanguageSwitch", () => {
  it("on an English page, links to the same page in Hindi", () => {
    pathname.current = "/en/no-such-page";
    render(withIntl(<LanguageSwitch />, "en"));

    const link = screen.getByRole("link", { name: "Read in हिन्दी" });
    expect(link.getAttribute("href")).toBe("/hi/no-such-page");
    expect(link.getAttribute("hreflang")).toBe("hi");
    expect(link.querySelector('[lang="hi"]')?.textContent).toBe("हिन्दी");
  });

  it("on a Hindi page, links to the same page in English", () => {
    pathname.current = "/hi";
    render(withIntl(<LanguageSwitch />, "hi"));

    const link = screen.getByRole("link", { name: "English में पढ़ें" });
    expect(link.getAttribute("href")).toBe("/en");
    expect(link.getAttribute("hreflang")).toBe("en");
    expect(link.querySelector('[lang="en"]')?.textContent).toBe("English");
  });

  it("links to the other language's home page while the address is not known yet", () => {
    render(withIntl(<LanguageLink />, "en"));

    expect(screen.getByRole("link", { name: "Read in हिन्दी" }).getAttribute("href")).toBe("/hi");
  });
});
