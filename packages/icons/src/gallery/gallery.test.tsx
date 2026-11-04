import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { iconList } from "../index";
import { filterIcons } from "./filterIcons";
import { IconGallery } from "./IconGallery";

const names = (list: readonly { name: string }[]) => list.map(({ name }) => name);
const shownNames = () =>
  within(screen.getByRole("list"))
    .queryAllByRole("listitem")
    .map((item) => item.textContent);

describe("filterIcons", () => {
  const icons = [{ name: "shopping-bag" }, { name: "cart" }, { name: "star-half" }];

  it("keeps only the icons whose name contains the query", () => {
    expect(names(filterIcons(icons, "bag"))).toEqual(["shopping-bag"]);
    expect(names(filterIcons(icons, "a"))).toEqual(["shopping-bag", "cart", "star-half"]);
  });

  it("ignores case and spaces around the query", () => {
    expect(names(filterIcons(icons, "  STAR "))).toEqual(["star-half"]);
  });

  it("keeps every icon for an empty query and none when nothing matches", () => {
    expect(names(filterIcons(icons, ""))).toEqual(names(icons));
    expect(filterIcons(icons, "umbrella")).toEqual([]);
  });
});

describe("IconGallery", () => {
  it("shows every icon with its name, and a labelled filter box", () => {
    render(<IconGallery />);
    expect(screen.getByRole("searchbox", { name: "Filter icons by name" })).toBeDefined();
    expect(shownNames()).toEqual(names(iconList));
    expect(screen.getByText(`${iconList.length} of ${iconList.length} icons`)).toBeDefined();
  });

  it("typing bag shows only the icons with bag in the name, and clearing shows all", () => {
    render(<IconGallery />);
    const box = screen.getByRole("searchbox");
    fireEvent.change(box, { target: { value: "bag" } });
    expect(shownNames()).toEqual(["shopping-bag"]);
    fireEvent.change(box, { target: { value: "" } });
    expect(shownNames()).toEqual(names(iconList));
  });

  it("says so when no icon matches", () => {
    render(<IconGallery initialQuery=" umbrella " />);
    expect(shownNames()).toEqual([]);
    expect(screen.getByText("No icon matches “umbrella”.")).toBeDefined();
  });

  it.each([16, 20, 24] as const)(
    "draws every icon at size %i, hidden from screen readers",
    (size) => {
      const { container } = render(<IconGallery size={size} />);
      const svgs = [...container.querySelectorAll("svg")];
      expect(svgs).toHaveLength(iconList.length);
      for (const svg of svgs) {
        expect(svg.getAttribute("width")).toBe(String(size));
        expect(svg.getAttribute("aria-hidden")).toBe("true");
      }
    },
  );
});
