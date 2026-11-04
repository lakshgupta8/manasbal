import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MESSAGES, withIntl } from "@/test/intl";
import ErrorPage from "./error";
import Loading from "./loading";
import NotFound from "./not-found";

describe("Loading", () => {
  it("says the page is loading, politely", () => {
    render(withIntl(<Loading />));

    expect(screen.getByRole("status").textContent).toBe("Loading…");
  });

  it("says so in Hindi on a Hindi page", () => {
    render(withIntl(<Loading />, "hi"));

    expect(screen.getByRole("status").textContent).toBe(MESSAGES.hi.Loading.message);
  });
});

describe("ErrorPage", () => {
  it("says the page couldn't load and offers a way on", () => {
    render(withIntl(<ErrorPage error={new Error("down")} retry={vi.fn()} />));

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("This page couldn't load");
    expect(screen.getByRole("link", { name: "Go to the home page" }).getAttribute("href")).toBe(
      "/en",
    );
  });

  it("never shows the error's own message", () => {
    render(withIntl(<ErrorPage error={new Error("secret detail")} retry={vi.fn()} />));

    expect(document.body.textContent).not.toContain("secret detail");
  });

  it("tries again when asked", () => {
    const retry = vi.fn();
    render(withIntl(<ErrorPage error={new Error("down")} retry={retry} />));

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(retry).toHaveBeenCalledOnce();
  });

  it("speaks Hindi on a Hindi page, and leads to the Hindi home page", () => {
    render(withIntl(<ErrorPage error={new Error("down")} retry={vi.fn()} />, "hi"));

    const words = MESSAGES.hi.Error;
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(words.heading);
    expect(screen.getByRole("button", { name: words.retry })).toBeDefined();
    expect(screen.getByRole("link", { name: words.home }).getAttribute("href")).toBe("/hi");
  });
});

describe("NotFound", () => {
  it("says there is no page here and links home", () => {
    render(withIntl(<NotFound />));

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Page not found");
    expect(screen.getByRole("link", { name: "Go to the home page" }).getAttribute("href")).toBe(
      "/en",
    );
  });

  it("says so in Hindi on a Hindi page", () => {
    render(withIntl(<NotFound />, "hi"));

    const words = MESSAGES.hi.NotFound;
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(words.heading);
    expect(screen.getByRole("link", { name: words.home }).getAttribute("href")).toBe("/hi");
  });
});
