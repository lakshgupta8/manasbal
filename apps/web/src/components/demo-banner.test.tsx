import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoBanner } from "./demo-banner";

describe("DemoBanner", () => {
  it("says the store is a demo", () => {
    render(<DemoBanner />);

    expect(screen.getByRole("note").textContent).toContain("nothing here is for sale");
  });
});
