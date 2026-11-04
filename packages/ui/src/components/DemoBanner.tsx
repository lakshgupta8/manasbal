import { LotusMark } from "./LotusMark";
import "./DemoBanner.css";

export interface DemoBannerProps {
  readonly className?: string;
  /** The landmark's name, in the page's language. */
  readonly label?: string;
  /** The first sentence, shown in bold. */
  readonly heading?: string;
  /** The rest of the message. */
  readonly detail?: string;
}

/** Sitewide notice that Manasbal is a demo: nothing is for sale and every order is simulated. */
export function DemoBanner({
  className,
  label = "Demo notice",
  heading = "Demo store: nothing here is for sale.",
  detail = "Orders, payments and deliveries are simulated, so please don't enter real details.",
}: DemoBannerProps) {
  return (
    <aside aria-label={label} className={["mb-demo-banner", className].filter(Boolean).join(" ")}>
      <LotusMark size={20} />
      <p>
        {/* One text node after the heading, as the message was before it took props. */}
        <strong>{heading}</strong>
        {` ${detail}`}
      </p>
    </aside>
  );
}
