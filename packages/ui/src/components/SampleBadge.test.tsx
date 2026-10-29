import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as stories from "./SampleBadge.stories";

const { Default } = composeStories(stories);

describe("SampleBadge", () => {
  it("shows the text Sample review", () => {
    render(<Default />);

    expect(screen.getByText("Sample review").className).toBe("mb-sample-badge");
  });

  it("adds a caller's class next to its own", () => {
    render(<Default className="sticky" />);

    expect(screen.getByText("Sample review").className).toBe("mb-sample-badge sticky");
  });
});
