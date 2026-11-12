import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoBanner } from "./DemoBanner";
import * as stories from "./DemoBanner.stories";

const { Default } = composeStories(stories);

describe("DemoBanner", () => {
  it("is a labelled landmark that says nothing is for sale", () => {
    render(<Default />);

    const banner = screen.getByRole("complementary", { name: "Demo notice" });
    expect(banner.textContent).toMatch(/nothing here is for sale/i);
  });

  it("keeps the lotus decorative, since the text already says it all", () => {
    render(<Default />);

    expect(screen.queryByRole("img")).toBeNull();
  });

  it("adds a caller's class next to its own", () => {
    render(<Default className="sticky" />);

    expect(screen.getByRole("complementary").className).toBe("mb-demo-banner sticky");
  });

  it("takes its name and both sentences in the page's language", () => {
    render(<DemoBanner label="डेमो सूचना" heading="पहला वाक्य।" detail="बाकी संदेश।" />);

    const banner = screen.getByRole("complementary", { name: "डेमो सूचना" });
    expect(banner.querySelector("strong")?.textContent).toBe("पहला वाक्य।");
    expect(banner.textContent).toContain("बाकी संदेश।");
  });
});
