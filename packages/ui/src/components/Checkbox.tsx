import { AlertIcon, CheckIcon } from "@manasbal/icons";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import "./Checkbox.css";

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "id" | "children"
> {
  /** The words to the right of the box; clicking them ticks it too. */
  readonly label: ReactNode;
  /** What is missing, under the label. Shown with an alert icon and a red border, never colour alone. */
  readonly error?: string;
}

/**
 * A box to say yes to one thing, with its label to the right. It is a real checkbox, and it is
 * never ticked unless the caller passes checked or defaultChecked.
 */
export function Checkbox({ label, error, className, ...props }: Readonly<CheckboxProps>) {
  const id = useId();
  const errorId = `${id}-error`;
  const classes = [
    "mb-checkbox",
    error && "mb-checkbox--error",
    props.disabled && "mb-checkbox--disabled",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <span className="mb-checkbox__box">
        <input
          {...props}
          id={id}
          type="checkbox"
          className="mb-checkbox__input"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <CheckIcon size={20} strokeWidth={2.4} className="mb-checkbox__tick" />
      </span>
      <span className="mb-checkbox__text">
        <label htmlFor={id}>{label}</label>
        {error && (
          <span id={errorId} className="mb-checkbox__error">
            <AlertIcon size={16} />
            {error}
          </span>
        )}
      </span>
    </div>
  );
}
