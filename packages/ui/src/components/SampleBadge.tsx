import "./SampleBadge.css";

export interface SampleBadgeProps {
  readonly className?: string;
}

/** Small pill that marks a review as a sample. */
export function SampleBadge({ className }: SampleBadgeProps) {
  return (
    <span className={["mb-sample-badge", className].filter(Boolean).join(" ")}>Sample review</span>
  );
}
