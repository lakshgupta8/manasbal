import { composeStories } from "@storybook/react-vite";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";
import * as stories from "./ConfirmDialog.stories";

const { Open, Dark, Busy, QuestionOnly, Mobile, FromAButton } = composeStories(stories);

// jsdom has no showModal or close; these do what matters here (the real behaviour, focus kept in
// and Esc, is checked in a browser by visual/keyboard.spec.ts).
const proto = HTMLDialogElement.prototype;
const real = { showModal: proto.showModal, close: proto.close };
beforeAll(() => {
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  proto.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});
afterAll(() => {
  Object.assign(proto, real);
});

const dialog = () => screen.getByRole("dialog", { hidden: true }) as HTMLDialogElement;

describe("ConfirmDialog", () => {
  it("opens as a dialog named by its question and described by its words", () => {
    render(<Open />);

    expect(dialog().open).toBe(true);
    expect(screen.getByRole("dialog", { name: "Delete this address?" })).toBe(dialog());
    expect(dialog().getAttribute("aria-describedby")).toBe(
      screen.getByText(/will be removed/).parentElement!.id,
    );
  });

  it("starts with focus on the safe choice", () => {
    render(<Open />);

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep it" }));
  });

  it("goes ahead only with the confirm button", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<Open onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancels with the cancel button and with Esc, and leaves closing to the caller", () => {
    const onCancel = vi.fn();
    render(<Open onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    const esc = new Event("cancel", { cancelable: true });
    dialog().dispatchEvent(esc);

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(esc.defaultPrevented).toBe(true);
    expect(dialog().open).toBe(true);
  });

  it("closes, and gives focus back to what opened it", () => {
    render(<FromAButton />);
    const opener = screen.getByRole("button", { name: "Delete" });
    opener.focus();
    fireEvent.click(opener);

    expect(dialog().open).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));

    expect(dialog().open).toBe(false);
    expect(document.activeElement).toBe(opener);
    expect(screen.getByText("Kept")).toBeDefined();

    fireEvent.click(opener);
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]!);
    expect(screen.getByText("Deleted")).toBeDefined();
  });

  it("doesn't move focus to something no longer on the page", () => {
    const { rerender } = render(
      <>
        <button type="button">Gone soon</button>
        <ConfirmDialog
          open={false}
          title="Sure?"
          confirmLabel="Yes"
          cancelLabel="No"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      </>,
    );
    const gone = screen.getByRole("button", { name: "Gone soon" });
    gone.focus();
    const props = { title: "Sure?", confirmLabel: "Yes", cancelLabel: "No" };
    rerender(
      <>
        <button type="button">Gone soon</button>
        <ConfirmDialog open {...props} onConfirm={() => {}} onCancel={() => {}} />
      </>,
    );
    const focusSpy = vi.spyOn(gone, "focus");
    rerender(<ConfirmDialog open={false} {...props} onConfirm={() => {}} onCancel={() => {}} />);

    expect(focusSpy).not.toHaveBeenCalled();
    expect(dialog().open).toBe(false);
  });

  it("makes both buttons wait while busy", () => {
    render(<Busy />);

    for (const button of screen.getAllByRole("button")) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("can ask the question alone", () => {
    render(<QuestionOnly />);

    expect(dialog().hasAttribute("aria-describedby")).toBe(false);
  });

  it("renders its other stories", () => {
    const { unmount } = render(<Dark />);
    expect(dialog().open).toBe(true);
    unmount();
    render(<Mobile />);
    expect(dialog().open).toBe(true);
  });

  it("styles only with theme tokens", () => {
    const css = readFileSync(join(import.meta.dirname, "ConfirmDialog.css"), "utf8");

    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).toContain("var(--mb-color-surface-page)");
  });
});
