"use client";

// A client component: the password version keeps whether it shows the password in state.
import { AlertIcon, EyeIcon, EyeOffIcon } from "@manasbal/icons";
import { useId, useState, type InputHTMLAttributes } from "react";
import "./TextField.css";

export type TextFieldType = "text" | "email" | "password" | "tel" | "url" | "search";

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "id" | "children"
> {
  /** Always shown above the box; a placeholder never stands in for it. */
  readonly label: string;
  readonly type?: TextFieldType;
  /** Help under the box. While there is an error, the error takes its place. */
  readonly hint?: string;
  /** What is wrong and how to fix it. Shown with an alert icon and a red border, never colour alone. */
  readonly error?: string;
  /** Adds "(required)" (or requiredText) to the label as well as the required attribute. */
  readonly required?: boolean;
  /** The "(required)" words in the page's language. */
  readonly requiredText?: string;
  /** Name of the password version's show button, in the page's language. */
  readonly showPasswordLabel?: string;
}

/** A labelled single-line box to type into. The password version can show what was typed. */
export function TextField({
  label,
  type = "text",
  hint,
  error,
  required = false,
  requiredText = "(required)",
  showPasswordLabel = "Show password",
  className,
  ...props
}: Readonly<TextFieldProps>) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const helpId = `${id}-help`;
  const help = error ?? hint;
  const isPassword = type === "password";
  const classes = [
    "mb-textfield",
    error && "mb-textfield--error",
    props.disabled && "mb-textfield--disabled",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <label className="mb-textfield__label" htmlFor={id}>
        {label}
        {required && <span className="mb-textfield__required">{` ${requiredText}`}</span>}
      </label>
      <div className="mb-textfield__box">
        <input
          {...props}
          id={id}
          className="mb-textfield__input"
          type={isPassword && shown ? "text" : type}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={help ? helpId : undefined}
        />
        {isPassword && (
          <button
            type="button"
            className="mb-textfield__toggle"
            aria-label={showPasswordLabel}
            aria-pressed={shown}
            aria-controls={id}
            disabled={props.disabled}
            onClick={() => setShown((value) => !value)}
          >
            {shown ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {error ? (
        <p id={helpId} className="mb-textfield__error">
          <AlertIcon size={16} />
          {error}
        </p>
      ) : (
        hint && (
          <p id={helpId} className="mb-textfield__hint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
