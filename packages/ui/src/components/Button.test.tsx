import { PlusIcon } from "@manasbal/icons";
import { composeStories } from "@storybook/react-vite";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import * as stories from "./Button.stories";

const { Primary, Secondary, Ghost, Small, WithIcon, Disabled, AllStatesLight, AllStatesDark } =
  composeStories(stories);

describe("Button", () => {
  it.each([
    { Story: Primary, classes: "mb-button mb-button--primary mb-button--md" },
    { Story: Secondary, classes: "mb-button mb-button--secondary mb-button--md" },
    { Story: Ghost, classes: "mb-button mb-button--ghost mb-button--md" },
    { Story: Small, classes: "mb-button mb-button--primary mb-button--sm" },
  ])("draws $classes", ({ Story, classes }) => {
    render(<Story />);

    expect(screen.getByRole("button", { name: "Add to cart" }).className).toBe(classes);
  });

  it("never submits a form unless asked", () => {
    render(
      <>
        <Button>Add to cart</Button>
        <Button type="submit">Place order</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Add to cart" }).getAttribute("type")).toBe("button");
    expect(screen.getByRole("button", { name: "Place order" }).getAttribute("type")).toBe("submit");
  });

  it("keeps its name from the words when it has an icon, which is hidden", () => {
    render(<WithIcon />);

    const button = screen.getByRole("button", { name: "Add to cart" });
    const icon = button.querySelector(".mb-button__icon");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.querySelector("svg")).not.toBeNull();
  });

  it("has no icon wrapper without an icon", () => {
    render(<Primary />);

    expect(screen.getByRole("button").querySelector(".mb-button__icon")).toBeNull();
  });

  it("calls onClick when pressed", () => {
    const onClick = vi.fn();
    render(<Primary onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("cannot be pressed when disabled", () => {
    const onClick = vi.fn();
    render(<Disabled onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Add to cart" });
    fireEvent.click(button);

    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("adds a caller's class and passes other attributes on", () => {
    render(
      <Button className="wide" aria-describedby="note" icon={<PlusIcon />} size="sm">
        Add
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Add" });
    expect(button.className).toBe("mb-button mb-button--primary mb-button--sm wide");
    expect(button.getAttribute("aria-describedby")).toBe("note");
  });

  it.each([
    { name: "light", Story: AllStatesLight },
    { name: "dark", Story: AllStatesDark },
  ])("the $name sheet has every variant, size, icon and state", ({ Story }) => {
    render(<Story />);

    const buttons = screen.getAllByRole("button", { name: "Add to cart" });
    // 3 variants x 2 sizes x with and without an icon x 4 states.
    expect(buttons).toHaveLength(48);
    expect(buttons.filter((button) => (button as HTMLButtonElement).disabled)).toHaveLength(12);
    expect(buttons.filter((button) => button.dataset.preview === "hover")).toHaveLength(12);
    expect(buttons.filter((button) => button.dataset.preview === "focus")).toHaveLength(12);
  });
});
