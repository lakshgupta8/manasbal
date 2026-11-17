import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button";
import "./ConfirmDialog.css";

export interface ConfirmDialogProps {
  /** Shows the dialog over the page; false closes it. */
  readonly open: boolean;
  /** The question, in the page's language, e.g. "Delete this address?". It names the dialog. */
  readonly title: string;
  /** More about what will happen, under the question. */
  readonly children?: ReactNode;
  /** The button that goes ahead, e.g. "Delete". */
  readonly confirmLabel: string;
  /** The button that changes nothing, e.g. "Keep it". It has focus when the dialog opens. */
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  /** Called for the cancel button and for Esc. */
  readonly onCancel: () => void;
  /** True while the confirmed action runs: both buttons wait. */
  readonly busy?: boolean;
}

/**
 * Asks before something that can't be undone. A real modal dialog (the browser's <dialog>, opened
 * with showModal): the rest of the page can't be reached until it closes, so focus stays inside
 * it; Esc and the cancel button both cancel. Focus starts on the cancel button, the safe choice,
 * and goes back to where it was when the dialog closes, if that is still on the page.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
}: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const element = dialog.current!;
    if (!open) return;
    const returnTo = document.activeElement;
    element.showModal();
    // The cancel button comes first: the safe choice has focus.
    element.querySelector("button")!.focus();
    return () => {
      element.close();
      if (returnTo instanceof HTMLElement && returnTo.isConnected) returnTo.focus();
    };
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="mb-confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={children === undefined ? undefined : bodyId}
      // Esc: the parent closes it, so it stays in step with `open`.
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id={titleId} className="mb-confirm-dialog__title">
        {title}
      </h2>
      {children !== undefined && (
        <div id={bodyId} className="mb-confirm-dialog__body">
          {children}
        </div>
      )}
      <div className="mb-confirm-dialog__actions">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
