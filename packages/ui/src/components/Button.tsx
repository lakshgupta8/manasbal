import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "md" | "sm";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** primary for the main action of a step (one per view), secondary for a lesser one, ghost for a quiet one. */
  readonly variant?: ButtonVariant;
  /** md is 44px tall, a full touch target; sm is 32px, for dense areas. */
  readonly size?: ButtonSize;
  /** "button" unless the caller says otherwise, so a button in a form never submits it by accident. */
  readonly type?: "button" | "submit" | "reset";
  /** An icon from @manasbal/icons before the words. It is decorative: the words name the button. */
  readonly icon?: ReactNode;
  readonly children: ReactNode;
}

/** A button with words, and optionally an icon before them. */
export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  icon,
  children,
  className,
  ...props
}: Readonly<ButtonProps>) {
  const classes = ["mb-button", `mb-button--${variant}`, `mb-button--${size}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button {...props} type={type} className={classes}>
      {icon && (
        <span className="mb-button__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}
