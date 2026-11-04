import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LanguageLink, LanguageSwitch } from "./language-switch";

const pathname = vi.hoisted(() => ({ current: "/en" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

describe("LanguageSwitch", () => {
  it("links to the same page in the target language, with the label it is given", () => {
    pathname.current = "/en/no-such-page";
    render(<LanguageSwitch target="hi">Read in Hindi</LanguageSwitch>);

    const link = screen.getByRole("link", { name: "Read in Hindi" });
    expect(link.getAttribute("href")).toBe("/hi/no-such-page");
    expect(link.getAttribute("hreflang")).toBe("hi");
  });

  it("leads from a Hindi page to the English one", () => {
    pathname.current = "/hi";
    render(<LanguageSwitch target="en">English</LanguageSwitch>);

    expect(screen.getByRole("link", { name: "English" }).getAttribute("href")).toBe("/en");
  });

  it("links to the other language's home page while the address is not known yet", () => {
    render(<LanguageLink target="hi">Read in Hindi</LanguageLink>);

    expect(screen.getByRole("link", { name: "Read in Hindi" }).getAttribute("href")).toBe("/hi");
  });
});
