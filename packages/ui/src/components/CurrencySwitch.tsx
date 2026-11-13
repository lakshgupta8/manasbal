import { CheckIcon } from "@manasbal/icons";
import type { ComponentProps } from "react";
import type { Currency } from "./Price";
import "./CurrencySwitch.css";

export interface CurrencySwitchProps {
  /** The currency prices show in now. */
  readonly current: Currency;
  /**
   * Where the choice goes: a server action, or an address the form posts to. The form sends
   * `currency` = INR or USD from its submit buttons: a plain form, with no client code of its own.
   */
  readonly action: ComponentProps<"form">["action"];
  /** The group's name, in the page's language. Defaults to "Prices in". */
  readonly label?: string;
  /** Each choice's words, in the page's language. */
  readonly names?: Readonly<Record<Currency, string>>;
  readonly className?: string;
}

const CHOICES: readonly Currency[] = ["INR", "USD"];
const ENGLISH_NAMES: Readonly<Record<Currency, string>> = { INR: "₹ INR", USD: "$ USD" };

/**
 * Two buttons, rupees and dollars, in a named group. The current one is pressed (aria-pressed),
 * filled, and has a tick, so the state is in words and shape, not colour alone. Pressing the
 * other submits the form.
 */
export function CurrencySwitch({
  current,
  action,
  label = "Prices in",
  names = ENGLISH_NAMES,
  className,
}: CurrencySwitchProps) {
  return (
    <form action={action} className={["mb-currency-switch", className].filter(Boolean).join(" ")}>
      <div role="group" aria-label={label} className="mb-currency-switch__group">
        {CHOICES.map((choice) => {
          const pressed = choice === current;
          return (
            <button
              key={choice}
              type="submit"
              name="currency"
              value={choice}
              aria-pressed={pressed}
              className="mb-currency-switch__choice"
            >
              {pressed && <CheckIcon size={16} />}
              {names[choice]}
            </button>
          );
        })}
      </div>
    </form>
  );
}
