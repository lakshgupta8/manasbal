import { CheckIcon } from "@manasbal/icons";
import "./VariantPicker.css";

export interface VariantPickerOption {
  /** What the form sends, and what onChange gives back. */
  readonly value: string;
  /** What the visitor sees, in the page's language, e.g. "M" or "Blue". */
  readonly label: string;
  /** False when it can't be chosen: disabled, crossed through and marked in words. */
  readonly available: boolean;
  /** Draws a state without a pointer or keyboard, so Storybook can show every state at once. */
  readonly preview?: "hover" | "focus";
}

export interface VariantPickerProps {
  /** The group's name, shown above the options, in the page's language, e.g. "Size". */
  readonly legend: string;
  /** The radio group's name: what a form sends the chosen value as. */
  readonly name: string;
  readonly options: readonly VariantPickerOption[];
  /** The chosen value, when the caller keeps it. Pass onChange with it. */
  readonly value?: string;
  /** The value chosen to begin with, when the picker keeps it itself. */
  readonly defaultValue?: string;
  readonly onChange?: (value: string) => void;
  /** Said after an option that can't be chosen. Defaults to "(not available)". */
  readonly unavailableLabel?: string;
  readonly className?: string;
}

/**
 * One choice of a product's variants, such as its size: a fieldset of real radio buttons under a
 * legend, drawn as a row of chips. Being radios, the arrow keys move and choose within the group
 * and Tab leaves it, with no script, and a form can send the choice without JavaScript.
 *
 * An option that can't be chosen is disabled, crossed through, and says so in words. The chosen
 * one is filled brand.primary with a tick, so it never relies on colour alone. Draw it on
 * surface.page: brand.primary on surface.card in dark is about 2.4:1, below the 3:1 rule.
 */
export function VariantPicker({
  legend,
  name,
  options,
  value,
  defaultValue,
  onChange,
  unavailableLabel = "(not available)",
  className,
}: VariantPickerProps) {
  const controlled = value !== undefined;

  return (
    <fieldset className={["mb-variant-picker", className].filter(Boolean).join(" ")}>
      <legend className="mb-variant-picker__legend">{legend}</legend>
      <div className="mb-variant-picker__options">
        {options.map((option) => (
          <label
            key={option.value}
            className="mb-variant-picker__option"
            data-preview={option.preview === "hover" ? "hover" : undefined}
          >
            <input
              type="radio"
              className="mb-variant-picker__input"
              name={name}
              value={option.value}
              disabled={!option.available}
              checked={controlled ? value === option.value : undefined}
              defaultChecked={controlled ? undefined : defaultValue === option.value}
              onChange={(event) => onChange?.(event.currentTarget.value)}
              data-preview={option.preview === "focus" ? "focus" : undefined}
            />
            <span className="mb-variant-picker__chip">
              <CheckIcon size={16} className="mb-variant-picker__tick" />
              <span className="mb-variant-picker__value">{option.label}</span>
              {/* The space keeps the words apart in the name read out; flex layout hides it. */}
              {!option.available && " "}
              {!option.available && (
                <span className="mb-variant-picker__unavailable">{unavailableLabel}</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
