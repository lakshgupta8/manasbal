import { composeStories } from "@storybook/react-vite";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Checkbox } from "./Checkbox";
import * as stories from "./Checkbox.stories";

const { Default, Ticked, WithError, Disabled, AllStatesLight, AllStatesDark } =
  composeStories(stories);

const box = (name = "Accept the terms") =>
  screen.getByRole("checkbox", { name }) as HTMLInputElement;

describe("Checkbox", () => {
  it("is a real checkbox, named by its label and never ticked to begin with", () => {
    render(<Default />);

    expect(box().type).toBe("checkbox");
    expect(box().checked).toBe(false);
    expect(box().hasAttribute("aria-invalid")).toBe(false);
    expect(box().hasAttribute("aria-describedby")).toBe(false);
  });

  it("ticks when the box or its label is clicked", () => {
    render(<Default />);

    fireEvent.click(box());
    expect(box().checked).toBe(true);

    fireEvent.click(screen.getByText("Accept the terms"));
    expect(box().checked).toBe(false);
  });

  it("starts ticked only when the caller says so", () => {
    render(<Ticked />);

    expect(box().checked).toBe(true);
  });

  it("follows the caller when controlled", () => {
    function Controlled() {
      const [checked, setChecked] = useState(false);
      return (
        <>
          <Checkbox
            label="Gift wrap"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <output>{checked ? "yes" : "no"}</output>
        </>
      );
    }
    render(<Controlled />);

    fireEvent.click(box("Gift wrap"));

    expect(box("Gift wrap").checked).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("yes");
  });

  it("shows an error with an icon under the label and marks the box invalid", () => {
    render(<WithError />);

    expect(box().getAttribute("aria-invalid")).toBe("true");
    const error = document.getElementById(box().getAttribute("aria-describedby")!);
    expect(error?.textContent).toBe("Tick the box to continue");
    expect(error?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(box().closest(".mb-checkbox")?.className).toBe("mb-checkbox mb-checkbox--error");
  });

  // The browser ignores clicks on a disabled checkbox (jsdom does not, so this checks the attribute).
  it("is greyed out and unusable when disabled", () => {
    render(<Disabled />);

    expect(box().disabled).toBe(true);
    expect(box().checked).toBe(false);
    expect(box().closest(".mb-checkbox")?.className).toBe("mb-checkbox mb-checkbox--disabled");
  });

  it("draws the tick from the icon set, hidden from assistive tech", () => {
    render(<Default />);

    const tick = box().nextElementSibling;
    expect(tick?.getAttribute("class")).toBe("mb-checkbox__tick");
    expect(tick?.getAttribute("aria-hidden")).toBe("true");
  });

  it("adds a caller's class next to its own", () => {
    render(<Checkbox label="Accept the terms" className="spaced" />);

    expect(box().closest(".mb-checkbox")?.className).toBe("mb-checkbox spaced");
  });

  it.each([
    { name: "light", Story: AllStatesLight },
    { name: "dark", Story: AllStatesDark },
  ])("the $name sheet has unticked and ticked boxes in every state", ({ Story }) => {
    render(<Story />);

    const boxes = screen.getAllByRole("checkbox", {
      name: "Accept the terms",
    }) as HTMLInputElement[];
    expect(boxes.map((b) => b.checked)).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(boxes.map((b) => b.dataset.preview ?? null)).toEqual([
      null,
      "focus",
      null,
      null,
      null,
      "focus",
      null,
      null,
    ]);
    expect(boxes.filter((b) => b.getAttribute("aria-invalid") === "true")).toHaveLength(2);
    expect(boxes.filter((b) => b.disabled)).toHaveLength(2);
  });
});
