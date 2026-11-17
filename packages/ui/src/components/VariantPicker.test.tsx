import { composeStories } from "@storybook/react-vite";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { VariantPicker } from "./VariantPicker";
import * as stories from "./VariantPicker.stories";

const { Default, Colours, NoneChosen, Controlled, Mobile, AllStatesLight, AllStatesDark } =
  composeStories(stories);

const radio = (name: string) => screen.getByRole("radio", { name }) as HTMLInputElement;

describe("VariantPicker", () => {
  it("is a group of radios named by its legend", () => {
    render(<Default />);

    const group = screen.getByRole("group", { name: "Size" });
    expect(group.tagName).toBe("FIELDSET");
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    for (const input of screen.getAllByRole("radio") as HTMLInputElement[]) {
      expect(input.name).toBe("size");
    }
    expect(radio("M").checked).toBe(true);
    expect(radio("S").checked).toBe(false);
  });

  it("disables an option that can't be chosen and says so in words, not only by crossing out", () => {
    render(<Default />);

    const large = radio("L (not available)");
    expect(large.disabled).toBe(true);
    expect(screen.getByText("(not available)").className).toBe("mb-variant-picker__unavailable");
    expect(screen.getByText("L").className).toBe("mb-variant-picker__value");
    expect(radio("XL").disabled).toBe(false);
  });

  it("says 'not available' in the page's language", () => {
    render(
      <VariantPicker
        legend="साइज़"
        name="size"
        options={[{ value: "L", label: "L", available: false }]}
        unavailableLabel="(उपलब्ध नहीं)"
      />,
    );

    expect(radio("L (उपलब्ध नहीं)").disabled).toBe(true);
  });

  it("chooses on its own when the caller doesn't keep the value", () => {
    render(<Default />);

    fireEvent.click(radio("S"));
    expect(radio("S").checked).toBe(true);
    expect(radio("M").checked).toBe(false);
  });

  it("starts with nothing chosen when given no value", () => {
    render(<NoneChosen />);

    expect(screen.getAllByRole("radio").filter((r) => (r as HTMLInputElement).checked)).toEqual([]);
  });

  it("tells the caller the new value, and follows the caller when controlled", () => {
    render(<Controlled />);

    fireEvent.click(radio("XL"));
    expect(radio("XL").checked).toBe(true);
    expect(screen.getByText("Chosen: XL")).toBeDefined();
  });

  it("keeps showing the caller's value until the caller changes it", () => {
    const onChange = vi.fn();
    render(
      <VariantPicker
        legend="Size"
        name="size"
        value="S"
        onChange={onChange}
        options={[
          { value: "S", label: "S", available: true },
          { value: "M", label: "M", available: true },
        ]}
      />,
    );

    fireEvent.click(radio("M"));
    expect(onChange).toHaveBeenCalledWith("M");
    expect(radio("S").checked).toBe(true);
  });

  it("can be changed without a handler", () => {
    render(
      <VariantPicker
        legend="Size"
        name="size"
        options={[
          { value: "S", label: "S", available: true },
          { value: "M", label: "M", available: true },
        ]}
      />,
    );

    fireEvent.click(radio("M"));
    expect(radio("M").checked).toBe(true);
  });

  it("sends the chosen value with a form, under its name", () => {
    render(
      <form aria-label="Pick">
        <Colours />
      </form>,
    );

    const form = screen.getByRole("form", { name: "Pick" }) as HTMLFormElement;
    expect(new FormData(form).get("colour")).toBe("Blue");
    fireEvent.click(radio("Black"));
    expect(new FormData(form).get("colour")).toBe("Black");
  });

  it("adds the caller's class", () => {
    render(
      <VariantPicker
        legend="Size"
        name="size"
        className="extra"
        options={[{ value: "S", label: "S", available: true }]}
      />,
    );

    expect(screen.getByRole("group").className).toBe("mb-variant-picker extra");
  });

  it("draws hover and focus on request, for the state sheet", () => {
    render(<AllStatesLight />);

    const labelIn = (group: string) =>
      screen.getByRole("group", { name: group }).querySelector("label") as HTMLLabelElement;
    const inputIn = (group: string) =>
      screen.getByRole("group", { name: group }).querySelector("input") as HTMLInputElement;

    expect(inputIn("focus").dataset.preview).toBe("focus");
    expect(labelIn("focus").dataset.preview).toBeUndefined();
    expect(labelIn("hover").dataset.preview).toBe("hover");
    expect(inputIn("hover").dataset.preview).toBeUndefined();
    expect(labelIn("default").dataset.preview).toBeUndefined();
    expect(inputIn("chosen").checked).toBe(true);
    expect(inputIn("unavailable").disabled).toBe(true);
  });

  it("renders its other stories", () => {
    const { unmount } = render(<AllStatesDark />);
    expect(screen.getAllByRole("group")).toHaveLength(6);
    unmount();
    render(<Mobile />);
    expect(radio("Mustard yellow (not available)").disabled).toBe(true);
  });

  it("styles only with theme tokens, and fills the chosen option only on surface.page", () => {
    const css = readFileSync(join(import.meta.dirname, "VariantPicker.css"), "utf8");

    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toContain("surface-card");
    expect(css).toContain("var(--mb-color-brand-primary)");
    expect(css).toContain("var(--mb-color-focus-ring)");
  });
});
