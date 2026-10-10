import { LotusMark } from "./LotusMark";
import "./DemoBanner.css";

export interface DemoBannerProps {
  className?: string;
}

/** Sitewide notice that Manasbal is a demo: nothing is for sale and every order is simulated. */
export function DemoBanner({ className }: DemoBannerProps) {
  return (
    <aside
      aria-label="Demo notice"
      className={["mb-demo-banner", className].filter(Boolean).join(" ")}
    >
      <LotusMark size={20} />
      <p>
        <strong>Demo store: nothing here is for sale.</strong> Orders, payments and deliveries are
        simulated, so please don&apos;t enter real details.
      </p>
    </aside>
  );
}
