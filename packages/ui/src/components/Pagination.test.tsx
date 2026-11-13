import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pagination, type PaginationLinkProps } from "./Pagination";
import * as stories from "./Pagination.stories";

const { Middle, FirstPage, LastPage, Dark, FirstPageDark } = composeStories(stories);

describe("Pagination", () => {
  it("links to the previous and next pages, with the status between", () => {
    render(<Middle />);

    const nav = screen.getByRole("navigation", { name: "Pages" });
    const previous = screen.getByRole("link", { name: "Previous page" });
    const next = screen.getByRole("link", { name: "Next page" });
    expect(previous.getAttribute("href")).toBe("#page-1");
    expect(previous.getAttribute("rel")).toBe("prev");
    expect(next.getAttribute("href")).toBe("#page-3");
    expect(next.getAttribute("rel")).toBe("next");
    expect(nav.textContent).toBe("Previous pagePage 2Next page");
  });

  it.each([FirstPage, FirstPageDark])("shows previous off on the first page (%#)", (Story) => {
    render(<Story />);

    expect(screen.queryByRole("link", { name: "Previous page" })).toBeNull();
    const off = screen.getByText("Previous page");
    expect(off.getAttribute("aria-disabled")).toBe("true");
    expect(off.hasAttribute("href")).toBe(false);
    expect(screen.getByRole("link", { name: "Next page" })).toBeDefined();
  });

  it("shows next off on the last page", () => {
    render(<LastPage />);

    expect(screen.queryByRole("link", { name: "Next page" })).toBeNull();
    expect(screen.getByText("Next page").getAttribute("aria-disabled")).toBe("true");
  });

  it("draws in the dark", () => {
    render(<Dark />);

    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("takes the caller's words, link component and class", () => {
    const ShopLink = (props: PaginationLinkProps) => (
      <a href={`/hi${props.href}`} rel={props.rel} className={props.className}>
        {props.children}
      </a>
    );
    render(
      <Pagination
        previousHref="/c/pens"
        nextHref="/c/pens?cursor=x"
        previousLabel="पिछला पेज"
        nextLabel="अगला पेज"
        status="पेज 2"
        label="पेज"
        linkAs={ShopLink}
        className="extra"
      />,
    );

    expect(screen.getByRole("navigation", { name: "पेज" }).className).toBe("mb-pagination extra");
    expect(screen.getByRole("link", { name: "अगला पेज" }).getAttribute("href")).toBe(
      "/hi/c/pens?cursor=x",
    );
  });
});
