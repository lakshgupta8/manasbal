import { StarHalfIcon, StarIcon } from "@manasbal/icons";
import "./Rating.css";

export interface RatingProps {
  /** From 0 to 5 in steps of 0.5. Anything else throws a RangeError. */
  readonly value: number;
  /**
   * What assistive tech reads for the stars, in the page's language. Defaults to
   * "Rated {value} out of 5".
   */
  readonly label?: string;
  /** Shown after the stars as real text, in the page's language, e.g. "(120 reviews)". */
  readonly reviews?: string;
  readonly className?: string;
}

const STARS = [1, 2, 3, 4, 5] as const;

/** Throws unless the value is a whole or half step from 0 to 5. */
function assertRating(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 5 || !Number.isInteger(value * 2)) {
    throw new RangeError(`A rating is 0 to 5 in steps of 0.5; got ${String(value)}`);
  }
}

/**
 * Five stars for a rating in halves, with the review count after it in words. The stars are
 * one image whose name gives the value in words; full and empty stars differ by shape (solid and
 * outline), not by colour alone.
 *
 * Draws on surface.page; brand.primary on surface.card in dark is about 2.4:1, below the 3:1 icon
 * rule, so a future ProductCard must use surface.page (as in Figma) or this needs a new token.
 */
export function Rating({ value, label, reviews, className }: RatingProps) {
  assertRating(value);

  return (
    <span className={["mb-rating", className].filter(Boolean).join(" ")}>
      <span role="img" aria-label={label ?? `Rated ${value} out of 5`} className="mb-rating__stars">
        {STARS.map((star) => {
          if (value >= star) return <StarIcon key={star} className="mb-rating__full" />;
          if (value === star - 0.5) {
            return (
              <span key={star} className="mb-rating__half">
                <StarHalfIcon className="mb-rating__empty" />
                <StarIcon className="mb-rating__full" />
              </span>
            );
          }
          return <StarIcon key={star} className="mb-rating__empty" />;
        })}
      </span>
      {reviews && <span className="mb-rating__reviews">{reviews}</span>}
    </span>
  );
}
