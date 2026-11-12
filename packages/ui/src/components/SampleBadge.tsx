import "./SampleBadge.css";

/** "review" marks a sample review; "item" marks sample product data, such as a picture. */
export type SampleBadgeKind = "review" | "item";

export interface SampleBadgeProps {
  /** What is a sample. Defaults to "review". */
  readonly kind?: SampleBadgeKind;
  /**
   * The words on the badge, in the page's language. Defaults to "Sample review" for a review and
   * "Sample" for an item.
   */
  readonly label?: string;
  readonly className?: string;
}

const DEFAULT_LABEL: Record<SampleBadgeKind, string> = {
  review: "Sample review",
  item: "Sample",
};

/** Small pill that marks a review, or a product's picture or data, as a sample. */
export function SampleBadge({ kind = "review", label, className }: SampleBadgeProps) {
  return (
    <span className={["mb-sample-badge", className].filter(Boolean).join(" ")}>
      {label ?? DEFAULT_LABEL[kind]}
    </span>
  );
}
