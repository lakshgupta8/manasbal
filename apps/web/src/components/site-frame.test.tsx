import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MAIN_ID, REPO_URL, SiteFrame } from "./site-frame";

// What Tab reaches, in order: nothing in the frame sets a positive tabindex.
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

describe("SiteFrame", () => {
  it("puts the skip link first, then the banner, header, page and footer", () => {
    const { container } = render(
      <SiteFrame>
        <h1>The page</h1>
      </SiteFrame>,
    );

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

  it("reaches the skip link first with Tab, and it leads to the page", () => {
    const { container } = render(<SiteFrame>page</SiteFrame>);

    const skip = screen.getByRole("link", { name: "Skip to main content" });
    expect(container.querySelector(FOCUSABLE)).toBe(skip);
    expect(
      container.querySelector('[tabindex]:not([tabindex="-1"]):not([tabindex="0"])'),
    ).toBeNull();
    expect(skip.getAttribute("href")).toBe(`#${MAIN_ID}`);
    expect(screen.getByRole("main").id).toBe(MAIN_ID);
  });

  it("links the source code from the footer", () => {
    render(<SiteFrame>page</SiteFrame>);

    expect(screen.getByRole("link", { name: "Source code on GitHub" }).getAttribute("href")).toBe(
      REPO_URL,
    );
  });
});
