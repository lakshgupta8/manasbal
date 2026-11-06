import { composeStories } from "@storybook/react-vite";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextField } from "./TextField";
import * as stories from "./TextField.stories";

const { Default, WithError, Disabled, Password, AllStatesLight, AllStatesDark } =
  composeStories(stories);

const description = (element: HTMLElement) =>
  document.getElementById(element.getAttribute("aria-describedby") ?? "")?.textContent;

describe("TextField", () => {
  it("is named by its label and described by its hint", () => {
    render(<Default />);

    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input.getAttribute("type")).toBe("email");
    expect((input as HTMLInputElement).value).toBe("name@example.test");
    expect(description(input)).toBe("We use it only to sign you in");
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(input.hasAttribute("required")).toBe(false);
  });

  it("shows an error with an icon in place of the hint, and marks the box invalid", () => {
    render(<WithError />);

    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(description(input)).toBe("Enter an email like name@example.test");
    expect(screen.queryByText("We use it only to sign you in")).toBeNull();
    const error = screen.getByText("Enter an email like name@example.test");
    expect(error.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(input.closest(".mb-textfield")?.classList.contains("mb-textfield--error")).toBe(true);
  });

  it("has no description without a hint or an error", () => {
    render(<TextField label="Name" />);

    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input.getAttribute("type")).toBe("text");
    expect(input.hasAttribute("aria-describedby")).toBe(false);
  });

  it("says (required) in its label when required", () => {
    render(<Password />);

    const input = screen.getByLabelText("Password (required)");
    expect(input.hasAttribute("required")).toBe(true);
  });

  it("takes (required) and the show button's name in the page's language", () => {
    render(
      <TextField
        label="पासवर्ड"
        type="password"
        required
        requiredText="(ज़रूरी)"
        showPasswordLabel="पासवर्ड दिखाएँ"
      />,
    );

    expect(screen.getByLabelText("पासवर्ड (ज़रूरी)")).not.toBeNull();
    expect(screen.getByRole("button", { name: "पासवर्ड दिखाएँ" })).not.toBeNull();
  });

  it("shows and hides the password with the eye button", () => {
    render(<Password />);

    const input = screen.getByLabelText("Password (required)");
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(input.getAttribute("type")).toBe("password");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe(input.id);
    expect(toggle.getAttribute("type")).toBe("button");

    fireEvent.click(toggle);
    expect(input.getAttribute("type")).toBe("text");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(toggle);
    expect(input.getAttribute("type")).toBe("password");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("draws the eye while the password is hidden and the crossed eye while it shows", () => {
    render(<Password />);

    const toggle = screen.getByRole("button", { name: "Show password" });
    const before = toggle.innerHTML;
    fireEvent.click(toggle);

    expect(toggle.innerHTML).not.toBe(before);
    expect(toggle.querySelectorAll("path")).toHaveLength(2);
  });

  it("has no eye button unless it is a password", () => {
    render(<Default />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is greyed out and unusable when disabled, eye button included", () => {
    render(
      <>
        <Disabled />
        <TextField label="Password" type="password" disabled />
      </>,
    );

    const input = screen.getByRole("textbox", { name: "Email" }) as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.closest(".mb-textfield")?.classList.contains("mb-textfield--disabled")).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Show password" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("adds a caller's class next to its own", () => {
    render(<TextField label="Name" className="wide" />);

    expect(screen.getByRole("textbox").closest("div.mb-textfield")?.className).toBe(
      "mb-textfield wide",
    );
  });

  it("gives each field its own id", () => {
    render(
      <>
        <TextField label="First" hint="One" />
        <TextField label="Second" hint="Two" />
      </>,
    );

    expect(description(screen.getByRole("textbox", { name: "First" }))).toBe("One");
    expect(description(screen.getByRole("textbox", { name: "Second" }))).toBe("Two");
  });

  it.each([
    { name: "light", Story: AllStatesLight },
    { name: "dark", Story: AllStatesDark },
  ])("the $name sheet has both versions in every state", ({ Story }) => {
    render(<Story />);

    const emails = screen.getAllByRole("textbox", { name: "Email" });
    const passwords = screen.getAllByLabelText("Password (required)");
    expect(emails).toHaveLength(4);
    expect(passwords).toHaveLength(4);
    for (const fields of [emails, passwords]) {
      expect(fields.map((field) => field.dataset.preview ?? null)).toEqual([
        null,
        "focus",
        null,
        null,
      ]);
      expect(fields.map((field) => field.getAttribute("aria-invalid"))).toEqual([
        null,
        null,
        "true",
        null,
      ]);
      expect(fields.map((field) => (field as HTMLInputElement).disabled)).toEqual([
        false,
        false,
        false,
        true,
      ]);
    }
    expect(description(passwords[2]!)).toBe("Use at least 12 characters");
  });
});
