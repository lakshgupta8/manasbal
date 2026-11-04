import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "./error";
import Loading from "./loading";
import NotFound from "./not-found";

describe("Loading", () => {
  it("says the page is loading, politely", () => {
    render(<Loading />);

    expect(screen.getByRole("status").textContent).toBe("Loading…");
  });
});

describe("ErrorPage", () => {
  it("says the page couldn't load and offers a way on", () => {
    render(<ErrorPage error={new Error("down")} retry={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("This page couldn't load");
    expect(screen.getByRole("link", { name: "Go to the home page" }).getAttribute("href")).toBe(
      "/",
    );
  });

  it("never shows the error's own message", () => {
    render(<ErrorPage error={new Error("secret detail")} retry={vi.fn()} />);

    expect(document.body.textContent).not.toContain("secret detail");
  });

  it("tries again when asked", () => {
    const retry = vi.fn();
    render(<ErrorPage error={new Error("down")} retry={retry} />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(retry).toHaveBeenCalledOnce();
  });
});

describe("NotFound", () => {
  it("says there is no page here and links home", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Page not found");
    expect(screen.getByRole("link", { name: "Go to the home page" }).getAttribute("href")).toBe(
      "/",
    );
  });
});
