import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as stories from "./SampleBadge.stories";

const { Default, Item, Dark } = composeStories(stories);

describe("SampleBadge", () => {
  it("shows the text Sample review", () => {
    render(<Default />);

    expect(screen.getByText("Sample review").className).toBe("mb-sample-badge");
  });

  it("adds a caller's class next to its own", () => {
    render(<Default className="sticky" />);

    expect(screen.getByText("Sample review").className).toBe("mb-sample-badge sticky");
  });

  it("says Sample for an item", () => {
    render(<Item />);

    expect(screen.getByText("Sample").className).toBe("mb-sample-badge");
  });

  it("takes its words from the caller", () => {
    render(<Item label="नमूना" />);

    expect(screen.getByText("नमूना")).toBeDefined();
    expect(screen.queryByText("Sample")).toBeNull();
  });

  it("draws both kinds in the dark", () => {
    render(<Dark />);

    expect(screen.getByText("Sample review")).toBeDefined();
    expect(screen.getByText("Sample")).toBeDefined();
  });
});
