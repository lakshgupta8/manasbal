import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

// The list has its own test; here it is a stand-in so the page renders without the API.
vi.mock("@/components/categories", () => ({ Categories: () => <p>the list</p> }));

describe("Home", () => {
  it("shows the shop name and the categories section", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1, name: "Manasbal" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Categories" })).toBeDefined();
    expect(screen.getByText("the list")).toBeDefined();
  });
});
