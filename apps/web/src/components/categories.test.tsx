import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCategories } from "@/lib/categories";
import { Categories } from "./categories";

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/categories", () => ({ getCategories: vi.fn() }));

describe("Categories", () => {
  beforeEach(() => {
    vi.mocked(getCategories).mockReset();
  });

  it("lists the category names", async () => {
    vi.mocked(getCategories).mockResolvedValue([
      { id: "1a2b3c4d-0000-4000-8000-000000000001", name: "Shoes", slug: "shoes", children: [] },
      { id: "1a2b3c4d-0000-4000-8000-000000000002", name: "Caps", slug: "caps", children: [] },
    ]);

    render(await Categories());

    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Shoes",
      "Caps",
    ]);
  });

  it("says the categories are unavailable when there are none to show", async () => {
    vi.mocked(getCategories).mockResolvedValue(null);

    render(await Categories());

    expect(screen.getByRole("alert").textContent).toBe(
      "Problem: Categories are unavailable right now",
    );
  });
});
