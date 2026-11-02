import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as stories from "./Notice.stories";

const { Default, Warning, ErrorTone } = composeStories(stories);

describe("Notice", () => {
  it.each([
    { tone: "info", Story: Default, role: "status", leadWord: "Note:" },
    { tone: "warning", Story: Warning, role: "status", leadWord: "Warning:" },
    { tone: "error", Story: ErrorTone, role: "alert", leadWord: "Problem:" },
  ])("$tone has role $role and lead word $leadWord", ({ Story, role, leadWord }) => {
    render(<Story />);

    const region = screen.getByRole(role);
    expect(region.querySelector("strong")?.textContent).toBe(leadWord);
    expect(region.textContent?.startsWith(`${leadWord} `)).toBe(true);
  });

  it("is a polite status region for info, not an alert", () => {
    render(<Default />);

    expect(screen.getByRole("status").textContent).toBe(
      "Note: Delivery times may vary during holidays.",
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("adds a caller's class next to its own", () => {
    render(<Default className="sticky" />);

    expect(screen.getByRole("status").className).toBe("mb-notice mb-notice--info sticky");
  });
});
